from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator, RegexValidator
from django.db import models


phone_validator = RegexValidator(
    regex=r'^\+[1-9]\d{7,14}$',
    message='Enter a valid phone number with country code, for example +919876543210.',
)


class FarmerProfile(models.Model):
    """Stores farmer identity and geocoded farm coordinates.

    This model unifies the original accounts profile with the richer Farmer app
    profile so both the DRF/telemetry flow and the Django-template Farmer flow
    share a single record (and a single ``farmer_profile`` reverse accessor).
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
    # Original accounts fields
    full_name = models.CharField(max_length=150, blank=True, default='')
    location_name = models.CharField(max_length=255, blank=True, default='')
    # Farmer app fields
    phone_number = models.CharField(
        max_length=20,
        unique=True,
        null=True,
        blank=True,
        validators=[phone_validator],
    )
    phone_verified = models.BooleanField(default=False)
    email_verified = models.BooleanField(default=False)
    name = models.CharField(max_length=150, blank=True, default='')
    place_name = models.CharField(max_length=255, blank=True, default='')
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    farm_area_acres = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
        validators=[MinValueValidator(0.01)],
    )
    crops_grown = models.JSONField(default=list, blank=True)
    gender = models.CharField(max_length=20, blank=True, default='', choices=Gender.choices)
    age = models.PositiveSmallIntegerField(
        null=True,
        blank=True,
        validators=[MinValueValidator(13), MaxValueValidator(120)],
    )
    preferred_language = models.CharField(
        max_length=10,
        choices=Language.choices,
        default=Language.ENGLISH,
        blank=True,
    )
    terms_accepted = models.BooleanField(default=False)
    terms_accepted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        verbose_name = 'Farmer Profile'
        verbose_name_plural = 'Farmer Profiles'

    def __str__(self) -> str:
        display = self.full_name or self.name or self.user.email
        return f'{display} ({self.user.email})'
