from django.conf import settings
from django.core.validators import RegexValidator
from django.db import models

from accounts.models import FarmerProfile

# Re-export so ``Farmer.models.FarmerProfile`` resolves to the unified model.
__all__ = ['FarmerProfile', 'PhoneVerification', 'phone_validator']

phone_validator = RegexValidator(
    regex=r'^\+[1-9]\d{7,14}$',
    message='Enter a valid phone number with country code, for example +919876543210.',
)


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
