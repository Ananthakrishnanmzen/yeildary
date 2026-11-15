from __future__ import annotations

import json
import logging
import threading

from django.conf import settings
from django.contrib import messages
from django.contrib.auth import authenticate, get_user_model, login, logout
from django.contrib.auth.decorators import login_required
from django.contrib.auth.views import (
    PasswordResetConfirmView,
    PasswordResetDoneView,
    PasswordResetView,
)
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.core.mail import send_mail
from django.shortcuts import redirect, render
from django.template.loader import render_to_string
from django.urls import reverse, reverse_lazy
from django.utils import timezone
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.cache import never_cache
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from rest_framework_simplejwt.tokens import RefreshToken
from django.views.generic import TemplateView

from .forms import (
    FarmerLoginForm,
    FarmerPasswordResetForm,
    FarmerSetPasswordForm,
    FarmerSignupForm,
)
from .models import FarmerProfile
from telemetry.views import compute_and_save_farmer_telemetry
from terrain.views import compute_and_save_farmer_terrain
from .services import (
    PhoneVerificationError,
    create_email_verification,
    verify_email_code,
    create_phone_verification,
    mask_phone_number,
    normalize_phone_number,
    verify_firebase_id_token,
    verify_phone_code,
)

User = get_user_model()

logger = logging.getLogger(__name__)


def _dashboard_url() -> str:
    return getattr(settings, 'FARMER_DASHBOARD_URL', reverse('farmer:dashboard'))


def _safe_next_url(request, candidate: str | None) -> str | None:
    if not candidate:
        return None
    host = request.get_host()
    if url_has_allowed_host_and_scheme(
        candidate,
        allowed_hosts={host},
        require_https=request.is_secure(),
    ):
        return candidate
    return None


def _json_body(request) -> dict:
    if (request.content_type or '').startswith('application/json'):
        try:
            payload = json.loads(request.body.decode('utf-8') or '{}')
        except (UnicodeDecodeError, json.JSONDecodeError):
            return {}
        return payload if isinstance(payload, dict) else {}
    return request.POST.dict()


def _ensure_session_key(request) -> str:
    if not request.session.session_key:
        request.session.create()
    return request.session.session_key


@never_cache
def farmer_login(request):
    if request.user.is_authenticated:
        return redirect(_dashboard_url())

    next_url = request.GET.get('next') or request.POST.get('next')
    form = FarmerLoginForm(request.POST or None)

    if request.method == 'POST' and form.is_valid():
        user = authenticate(
            request,
            username=form.cleaned_data['email'],
            password=form.cleaned_data['password'],
        )
        if user is None:
            form.add_error(None, 'Invalid email or password. Please try again.')
        elif not user.is_active:
            form.add_error(None, 'This account has been deactivated.')
        else:
            login(request, user)
            if form.cleaned_data.get('remember_me'):
                # Persist the session across browser restarts for 30 days.
                request.session.set_expiry(60 * 60 * 24 * 30)
            else:
                # Session cookie is cleared when the browser closes.
                request.session.set_expiry(0)
            messages.success(request, f'Welcome back, {user.first_name or user.username}!')
            if user.is_staff or user.is_superuser:
                destination = reverse('admin:index')
            else:
                destination = _dashboard_url()
            return redirect(_safe_next_url(request, next_url) or destination)

    return render(
        request,
        'Farmer/login.html',
        {'form': form, 'next': next_url or ''},
    )


@never_cache
def farmer_signup(request):
    if request.user.is_authenticated:
        return redirect(_dashboard_url())

    form = FarmerSignupForm(request.POST or None)
    verified = request.session.get('farmer_phone_verified') or {}

    if request.method == 'POST' and form.is_valid():
        verified_phone = verified.get('phone')
        if not verified_phone or verified_phone != form.cleaned_data['phone_number']:
            form.add_error(
                'phone_number',
                'Verify this phone number with the SMS code before creating '
                'your account.',
            )
        else:
            try:
                with transaction.atomic():
                    user = User.objects.create_user(
                        username=form.cleaned_data['email'],
                        email=form.cleaned_data['email'],
                        password=form.cleaned_data['password'],
                        first_name=form.cleaned_data['name'],
                    )
                    profile = FarmerProfile.objects.create(
                        user=user,
                        phone_number=form.cleaned_data['phone_number'],
                        phone_verified=True,
                        name=form.cleaned_data['name'],
                        place_name=form.cleaned_data['place_name'],
                        latitude=form.cleaned_data['latitude'],
                        longitude=form.cleaned_data['longitude'],
                        farm_area_acres=form.cleaned_data['farm_area_acres'],
                        crops_grown=form.cleaned_data['crops_grown'],
                        gender=form.cleaned_data['gender'],
                        age=form.cleaned_data['age'],
                        preferred_language=form.cleaned_data['preferred_language'],
                        terms_accepted=True,
                        terms_accepted_at=timezone.now(),
                    )
            except IntegrityError:
                form.add_error(
                    None,
                    'An account with this email or phone number already exists.',
                )
            else:
                request.session.pop('farmer_phone_verified', None)
                request.session.pop('farmer_email_verified', None)
                login(request, user, backend='Farmer.backends.EmailBackend')
                messages.success(
                    request,
                    f'Your farmer account is ready. Welcome, {user.first_name}!',
                )
                return redirect(_dashboard_url())

    return render(
        request,
        'Farmer/signup.html',
        {
            'form': form,
            'firebase_config': settings.FIREBASE_CONFIG,
            'phone_verified_phone': verified.get('phone', ''),
            'phone_dev_mode': getattr(
                settings, 'PHONE_VERIFICATION_DEV_MODE', settings.DEBUG
            ),
        },
    )



@csrf_exempt
@require_POST
def farmer_signup_api(request):
    """JSON endpoint used by the Vite frontend to create a farmer account."""

    payload = _json_body(request)
    # Normalise a few fields so the Django form receives the expected shapes.
    data = dict(payload)
    if 'terms_accepted' in data and isinstance(data['terms_accepted'], bool):
        data['terms_accepted'] = 'on' if data['terms_accepted'] else ''
    if isinstance(data.get('crops_grown'), list):
        data['crops_grown'] = ', '.join(data['crops_grown'])

    form = FarmerSignupForm(data)
    if not form.is_valid():
        errors = {}
        for field, errs in form.errors.items():
            errors[field] = [str(e) for e in errs]
        return JsonResponse({'ok': False, 'errors': errors}, status=400)

    verified = request.session.get('farmer_email_verified') or {}
    verified_email = verified.get('email')
    if not verified_email or verified_email != form.cleaned_data['email']:
        return JsonResponse(
            {
                'ok': False,
                'errors': {
                    'email': [
                        'Verify this email address with the code before creating '
                        'your account.'
                    ]
                },
            },
            status=400,
        )

    try:
        with transaction.atomic():
            user = User.objects.create_user(
                username=form.cleaned_data['email'],
                email=form.cleaned_data['email'],
                password=form.cleaned_data['password'],
                first_name=form.cleaned_data['name'],
            )
            profile = FarmerProfile.objects.create(
                user=user,
                phone_number=form.cleaned_data['phone_number'],
                phone_verified=False,
                email_verified=True,
                full_name=form.cleaned_data['name'],
                location_name=form.cleaned_data['place_name'],
                name=form.cleaned_data['name'],
                place_name=form.cleaned_data['place_name'],
                latitude=form.cleaned_data['latitude'],
                longitude=form.cleaned_data['longitude'],
                farm_area_acres=form.cleaned_data['farm_area_acres'],
                crops_grown=form.cleaned_data['crops_grown'],
                gender=form.cleaned_data['gender'],
                age=form.cleaned_data['age'],
                preferred_language=form.cleaned_data['preferred_language'],
                terms_accepted=True,
                terms_accepted_at=timezone.now(),
            )
    except IntegrityError:
        return JsonResponse(
            {'ok': False, 'errors': {'__all__': ['An account with this email or phone number already exists.']}},
            status=409,
        )

    request.session.pop('farmer_phone_verified', None)
    request.session.pop('farmer_email_verified', None)

    def _precompute(profile_id: int) -> None:
        try:
            from accounts.models import FarmerProfile as AP

            profile = AP.objects.get(pk=profile_id)
            compute_and_save_farmer_telemetry(profile)
            compute_and_save_farmer_terrain(profile)
        except Exception:
            logger.exception('Background telemetry/terrain precomputation failed for farmer %s', profile_id)

    transaction.on_commit(
        lambda: threading.Thread(target=_precompute, args=(profile.pk,), daemon=True).start()
    )

    refresh = RefreshToken.for_user(user)
    return JsonResponse(
        {
            'ok': True,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'redirect': _dashboard_url(),
        },
        status=201,
    )


@require_POST
def farmer_logout(request):
    logout(request)
    messages.info(request, 'You have been signed out.')
    return redirect('farmer:login')


@login_required
def farmer_dashboard(request):
    profile = None
    try:
        profile = request.user.farmer_profile
    except FarmerProfile.DoesNotExist:
        pass

    return render(request, 'Farmer/dashboard.html', {'profile': profile})


@csrf_exempt
@require_POST
def phone_send_code(request):
    payload = _json_body(request)
    raw_phone = payload.get('phone_number', '')

    try:
        phone_number = normalize_phone_number(raw_phone)
    except ValidationError as exc:
        return JsonResponse({'ok': False, 'error': exc.messages[0]}, status=400)

    if FarmerProfile.objects.filter(phone_number=phone_number).exists():
        return JsonResponse(
            {
                'ok': False,
                'error': 'This phone number is already linked to another account.',
            },
            status=409,
        )

    dev_mode = getattr(settings, 'PHONE_VERIFICATION_DEV_MODE', settings.DEBUG)
    firebase_configured = bool(settings.FIREBASE_CONFIG.get('apiKey'))
    if not dev_mode and not firebase_configured:
        return JsonResponse(
            {
                'ok': False,
                'error': 'SMS verification is not configured on this server.',
            },
            status=503,
        )

    session_key = _ensure_session_key(request)
    try:
        _verification, code = create_phone_verification(phone_number, session_key)
    except PhoneVerificationError as exc:
        return JsonResponse({'ok': False, 'error': exc.message}, status=exc.status)

    response = {
        'ok': True,
        'message': f'Verification code sent to {mask_phone_number(phone_number)}.',
        'phone_number': phone_number,
    }
    if dev_mode:
        response['dev_code'] = code
        response['message'] = (
            'Development mode: no SMS was sent. Use the code shown below.'
        )
    return JsonResponse(response)


@csrf_exempt
@require_POST
def phone_verify_code(request):
    payload = _json_body(request)
    try:
        phone_number = normalize_phone_number(payload.get('phone_number'))
    except ValidationError as exc:
        return JsonResponse({'ok': False, 'error': exc.messages[0]}, status=400)

    code = str(payload.get('code', '')).strip()
    if not code:
        return JsonResponse(
            {'ok': False, 'error': 'Enter the verification code.'},
            status=400,
        )

    session_key = _ensure_session_key(request)
    try:
        verify_phone_code(phone_number, session_key, code)
    except PhoneVerificationError as exc:
        return JsonResponse({'ok': False, 'error': exc.message}, status=exc.status)

    request.session['farmer_phone_verified'] = {
        'phone': phone_number,
        'verified_at': timezone.now().isoformat(),
    }
    return JsonResponse(
        {
            'ok': True,
            'message': f'{mask_phone_number(phone_number)} verified successfully.',
            'phone_number': phone_number,
        }
    )


@csrf_exempt
@require_POST
def phone_verify_firebase(request):
    payload = _json_body(request)
    try:
        phone_number = normalize_phone_number(payload.get('phone_number'))
    except ValidationError as exc:
        return JsonResponse({'ok': False, 'error': exc.messages[0]}, status=400)

    try:
        verified_phone = verify_firebase_id_token(
            payload.get('id_token', ''),
            settings.FIREBASE_CONFIG.get('apiKey', ''),
        )
    except PhoneVerificationError as exc:
        return JsonResponse({'ok': False, 'error': exc.message}, status=exc.status)

    if verified_phone != phone_number:
        return JsonResponse(
            {
                'ok': False,
                'error': 'The verified phone number does not match the one entered.',
            },
            status=400,
        )

    request.session['farmer_phone_verified'] = {
        'phone': phone_number,
        'verified_at': timezone.now().isoformat(),
        'method': 'firebase',
    }
    return JsonResponse(
        {
            'ok': True,
            'message': f'{mask_phone_number(phone_number)} verified successfully.',
            'phone_number': phone_number,
        }
    )


@csrf_exempt
@require_POST
def email_send_code(request):
    payload = _json_body(request)
    email = (payload.get('email') or '').strip().lower()
    if not email:
        return JsonResponse({'ok': False, 'error': 'Enter an email address.'}, status=400)

    dev_mode = getattr(settings, 'PHONE_VERIFICATION_DEV_MODE', settings.DEBUG)
    # In development we always return the code; in production an email is sent.
    session_key = _ensure_session_key(request)
    try:
        _verification, code = create_email_verification(email, session_key)
    except PhoneVerificationError as exc:
        return JsonResponse({'ok': False, 'error': exc.message}, status=exc.status)

    plain_message = "Your verification code is: " + code + chr(10) + "It expires in 5 minutes." + chr(10) + chr(10) + "If you did not request this, you can safely ignore this message."
    html_message = render_to_string(
        'Farmer/email_verification.html', {'code': code, 'email': email}
    )
    try:
        send_mail(
            subject='Yieldary AI verification code',
            message=plain_message,
            from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@yieldary.ai'),
            recipient_list=[email],
            html_message=html_message,
            fail_silently=dev_mode,
        )
    except Exception:
        logger.exception('Failed to send verification email to %s', email)
        # Do not tell the user a code was sent when SMTP is misconfigured.
        return JsonResponse(
            {
                'ok': False,
                'error': 'Could not send the verification email. Please try again shortly.',
            },
            status=503,
        )

    response = {
        'ok': True,
        'message': f'Verification code sent to {email}.',
        'email': email,
    }
    if dev_mode:
        response['dev_code'] = code
        response['message'] = 'Development mode: use the code shown below.'
    return JsonResponse(response)


@csrf_exempt
@require_POST
def email_verify_code(request):
    payload = _json_body(request)
    email = (payload.get('email') or '').strip().lower()
    code = str(payload.get('code', '')).strip()
    if not email:
        return JsonResponse({'ok': False, 'error': 'Enter an email address.'}, status=400)
    if not code:
        return JsonResponse({'ok': False, 'error': 'Enter the verification code.'}, status=400)

    session_key = _ensure_session_key(request)
    try:
        verify_email_code(email, session_key, code)
    except PhoneVerificationError as exc:
        return JsonResponse({'ok': False, 'error': exc.message}, status=exc.status)

    request.session['farmer_email_verified'] = {
        'email': email,
        'verified_at': timezone.now().isoformat(),
    }
    return JsonResponse({'ok': True, 'message': f'{email} verified successfully.', 'email': email})


class FarmerPasswordResetView(PasswordResetView):
    template_name = 'Farmer/password_reset_form.html'
    email_template_name = 'Farmer/password_reset_email.html'
    subject_template_name = 'Farmer/password_reset_subject.txt'
    form_class = FarmerPasswordResetForm
    success_url = reverse_lazy('farmer:password_reset_done')
    extra_email_context = {'brand_name': 'Yieldary AI'}


class FarmerPasswordResetDoneView(PasswordResetDoneView):
    template_name = 'Farmer/password_reset_done.html'


class FarmerPasswordResetConfirmView(PasswordResetConfirmView):
    template_name = 'Farmer/password_reset_confirm.html'
    form_class = FarmerSetPasswordForm
    success_url = reverse_lazy('farmer:password_reset_complete')


class FarmerPasswordResetCompleteView(TemplateView):
    template_name = 'Farmer/password_reset_complete.html'


class ResearcherPlaceholderView(TemplateView):
    template_name = 'Farmer/researcher_placeholder.html'


class LegalView(TemplateView):
    template_name = 'Farmer/legal.html'
# TEST MARKER
