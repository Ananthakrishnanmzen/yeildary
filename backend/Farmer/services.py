"""Phone-number verification helpers.

The browser uses Firebase phone auth when ``FIREBASE_CONFIG["apiKey"]`` is set.
When Firebase is not configured (local development), the app falls back to a
short-lived, session-bound SMS code. The fallback code is returned to the page
only in development so the signup flow can be completed without an SMS
provider.
"""

from __future__ import annotations

import json
import re
import secrets
from datetime import timedelta
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

from django.conf import settings
from django.contrib.auth.hashers import check_password, make_password
from django.core.exceptions import ValidationError
from django.utils import timezone

from .models import EmailVerification, PhoneVerification

PHONE_RE = re.compile(r'^\+[1-9]\d{7,14}$')


class PhoneVerificationError(Exception):
    """Raised when an SMS challenge cannot be created or verified."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.message = message
        self.status = status


def normalize_phone_number(raw: str | None) -> str:
    """Return an E.164-style number or raise ``ValidationError``."""

    value = (raw or '').strip()
    if not value:
        raise ValidationError('Phone number is required.')
    if any(character.isalpha() for character in value):
        raise ValidationError('Enter a valid phone number with country code.')
    value = re.sub(r'[\s().-]', '', value)
    if value.startswith('00'):
        value = f'+{value[2:]}'
    if not value.startswith('+'):
        raise ValidationError(
            'Include the country code, for example +919876543210.'
        )
    if not PHONE_RE.fullmatch(value):
        raise ValidationError(
            'Enter a valid phone number including country code (8-15 digits).'
        )
    return value


def mask_phone_number(phone_number: str) -> str:
    if len(phone_number) <= 6:
        return phone_number
    return f'{phone_number[:3]}****{phone_number[-3:]}'


def create_phone_verification(
    phone_number: str,
    session_key: str,
) -> tuple[PhoneVerification, str]:
    """Create a new code, invalidating older pending codes for this phone."""

    now = timezone.now()
    cooldown = int(getattr(settings, 'PHONE_VERIFICATION_RESEND_SECONDS', 60))
    if cooldown > 0 and PhoneVerification.objects.filter(
        phone_number=phone_number,
        created_at__gte=now - timedelta(seconds=cooldown),
    ).exists():
        raise PhoneVerificationError(
            f'Please wait {cooldown} seconds before requesting another code.',
            status=429,
        )

    PhoneVerification.objects.filter(
        phone_number=phone_number,
        consumed_at__isnull=True,
    ).update(consumed_at=now)

    code = f'{secrets.randbelow(1_000_000):06d}'
    ttl = int(getattr(settings, 'PHONE_VERIFICATION_CODE_TTL', 300))
    verification = PhoneVerification.objects.create(
        phone_number=phone_number,
        session_key=session_key,
        code_hash=make_password(code),
        expires_at=now + timedelta(seconds=ttl),
    )
    return verification, code


def verify_phone_code(
    phone_number: str,
    session_key: str,
    code: str,
) -> PhoneVerification:
    """Validate a fallback SMS code for the current browser session."""

    now = timezone.now()
    verification = (
        PhoneVerification.objects.filter(
            phone_number=phone_number,
            session_key=session_key,
            consumed_at__isnull=True,
        )
        .order_by('-created_at')
        .first()
    )
    if verification is None:
        raise PhoneVerificationError('Request a new verification code.')

    if verification.expires_at <= now:
        verification.consumed_at = now
        verification.save(update_fields=['consumed_at'])
        raise PhoneVerificationError('This verification code has expired.')

    max_attempts = int(getattr(settings, 'PHONE_VERIFICATION_MAX_ATTEMPTS', 5))
    if verification.attempts >= max_attempts:
        raise PhoneVerificationError(
            'Too many incorrect attempts. Request a new code.',
            status=429,
        )

    if not check_password(code, verification.code_hash):
        verification.attempts += 1
        verification.save(update_fields=['attempts'])
        remaining = max_attempts - verification.attempts
        suffix = f' {remaining} attempt(s) remaining.' if remaining > 0 else ''
        raise PhoneVerificationError(f'Incorrect verification code.{suffix}')

    verification.consumed_at = now
    verification.save(update_fields=['consumed_at'])
    return verification


def verify_firebase_id_token(id_token: str, api_key: str) -> str:
    """Verify a Firebase ID token and return its verified phone number.

    Uses Google's Identity Toolkit REST endpoint so no extra Python package is
    required. Google validates the token signature before returning the user.
    """

    if not id_token:
        raise PhoneVerificationError('Missing Firebase ID token.')
    if not api_key:
        raise PhoneVerificationError(
            'Firebase phone verification is not configured.',
            status=503,
        )

    endpoint = (
        'https://identitytoolkit.googleapis.com/v1/accounts:lookup'
        f'?key={quote(api_key)}'
    )
    request = Request(
        endpoint,
        data=json.dumps({'idToken': id_token}).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    try:
        with urlopen(request, timeout=10) as response:
            payload = json.loads(response.read().decode('utf-8'))
    except (HTTPError, URLError, TimeoutError, ValueError) as exc:
        raise PhoneVerificationError(
            'Could not verify the Firebase token. Please try again.',
            status=400,
        ) from exc

    users = payload.get('users') or []
    phone_number = users[0].get('phoneNumber') if users else None
    if not phone_number:
        raise PhoneVerificationError(
            'The verified Firebase account has no phone number.'
        )
    return normalize_phone_number(phone_number)

# ---------------------------------------------------------------------------
# Email verification helpers (mirror of the SMS flow, but delivered by email).
# ---------------------------------------------------------------------------


def create_email_verification(
    email: str,
    session_key: str,
) -> tuple[EmailVerification, str]:
    """Create a new email code, invalidating older pending codes for this email."""

    now = timezone.now()
    cooldown = int(getattr(settings, 'PHONE_VERIFICATION_RESEND_SECONDS', 60))
    if cooldown > 0 and EmailVerification.objects.filter(
        email=email,
        created_at__gte=now - timedelta(seconds=cooldown),
    ).exists():
        raise PhoneVerificationError(
            f'Please wait {cooldown} seconds before requesting another code.',
            status=429,
        )

    EmailVerification.objects.filter(
        email=email,
        consumed_at__isnull=True,
    ).update(consumed_at=now)

    code = f'{secrets.randbelow(1_000_000):06d}'
    ttl = int(getattr(settings, 'PHONE_VERIFICATION_CODE_TTL', 300))
    verification = EmailVerification.objects.create(
        email=email,
        session_key=session_key,
        code_hash=make_password(code),
        expires_at=now + timedelta(seconds=ttl),
    )
    return verification, code


def verify_email_code(
    email: str,
    session_key: str,
    code: str,
) -> EmailVerification:
    """Validate an email verification code for the current browser session."""

    now = timezone.now()
    verification = (
        EmailVerification.objects.filter(
            email=email,
            session_key=session_key,
            consumed_at__isnull=True,
        )
        .order_by('-created_at')
        .first()
    )
    if verification is None:
        verification = (
            EmailVerification.objects.filter(
                email=email,
                consumed_at__isnull=True,
            )
            .order_by('-created_at')
            .first()
        )
    if verification is None:
        raise PhoneVerificationError('Request a new verification code.')

    if verification.expires_at <= now:
        verification.consumed_at = now
        verification.save(update_fields=['consumed_at'])
        raise PhoneVerificationError('This verification code has expired.')

    max_attempts = int(getattr(settings, 'PHONE_VERIFICATION_MAX_ATTEMPTS', 5))
    if verification.attempts >= max_attempts:
        raise PhoneVerificationError(
            'Too many incorrect attempts. Request a new code.',
            status=429,
        )

    if not check_password(code, verification.code_hash):
        verification.attempts += 1
        verification.save(update_fields=['attempts'])
        remaining = max_attempts - verification.attempts
        suffix = f' {remaining} attempt(s) remaining.' if remaining > 0 else ''
        raise PhoneVerificationError(f'Incorrect verification code.{suffix}')

    verification.consumed_at = now
    verification.save(update_fields=['consumed_at'])
    return verification
