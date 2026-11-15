from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models


phone_validator = RegexValidator(
    regex=r'^\+[1-9]\d{7,14}$',
    message='Enter a valid phone number with country code, for example +919876543210.',
)


class FarmerProfile(models.Model):
    """Profile data captured during farmer signup.

    The profile is keyed by the authenticated user so the existing dashboard and
    any future API can resolve farm data from ``request.user.farmer_profile``.
    """

    class Gender(models.TextChoices):
        FEMALE = 'female', 'Female'
        MALE = 'male', 'Male'
        NON_BINARY = 'non_binary', 'Non-binary'
        PREFER_NOT_TO_SAY = 'prefer_not_to_say', 'Prefer not to say'
        OTHER = 'other', 'Other'

    class Language(models.TextChoices):
        ENGLISH = 'en', 'English'
        MALAYALAM = 'ml', 'Malayalam'
        HINDI = 'hi', 'Hindi'
        TAMIL = 'ta', 'Tamil'
        KANNADA = 'kn', 'Kannada'
        TELUGU = 'te', 'Telugu'
        OTHER = 'other', 'Other'

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='farmer_profile',
    )
    phone_number = models.CharField(
        max_length=20,
        unique=True,
        validators=[phone_validator],
    )
    phone_verified = models.BooleanField(default=False)
    name = models.CharField(max_length=150)
    place_name = models.CharField(
        max_length=255,
        help_text='Human readable place selected from OpenStreetMap.',
    )
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    farm_area_acres = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0.01)],
        help_text='Farm area in acres.',
    )
    crops_grown = models.JSONField(
        default=list,
        blank=True,
        help_text='List of crops grown by the farmer.',
    )
    gender = models.CharField(max_length=20, choices=Gender.choices)
    age = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(13), MaxValueValidator(120)],
    )
    preferred_language = models.CharField(
        max_length=10,
        choices=Language.choices,
        default=Language.ENGLISH,
    )
    terms_accepted = models.BooleanField(default=False)
    terms_accepted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Farmer profile'
        verbose_name_plural = 'Farmer profiles'

    def __str__(self):
        return f'{self.name} ({self.phone_number})'


class PhoneVerification(models.Model):
    """Short-lived SMS verification challenge tied to a browser session."""

    phone_number = models.CharField(max_length=20, db_index=True)
    session_key = models.CharField(max_length=40, db_index=True)
    code_hash = models.CharField(max_length=128)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['phone_number', 'session_key', 'consumed_at']),
        ]
        verbose_name = 'Phone verification'
        verbose_name_plural = 'Phone verifications'

    def __str__(self):
        return f'{self.phone_number} ({"used" if self.consumed_at else "pending"})'
