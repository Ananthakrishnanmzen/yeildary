from __future__ import annotations

import json

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
from django.shortcuts import redirect, render
from django.urls import reverse, reverse_lazy
from django.utils import timezone
from django.utils.http import url_has_allowed_host_and_scheme
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_POST
from django.views.generic import TemplateView

from .forms import (
    FarmerLoginForm,
    FarmerPasswordResetForm,
    FarmerSetPasswordForm,
    FarmerSignupForm,
)
from .models import FarmerProfile
from .services import (
    PhoneVerificationError,
    create_phone_verification,
    mask_phone_number,
    normalize_phone_number,
    verify_firebase_id_token,
    verify_phone_code,
)

User = get_user_model()


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
                    FarmerProfile.objects.create(
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
