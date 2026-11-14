from django.db import models

from accounts.models import FarmerProfile


def default_constraint_weights() -> dict:
    return {
        'water_availability': 50,
        'budget': 50,
        'market_demand': 50,
    }


class RotationStrategyReport(models.Model):
    """Stores Module 3 global rotation strategy & Gemini AI decision matrix."""

    class Status(models.TextChoices):
        PROCESSING = 'processing', 'Processing'
        COMPLETED = 'completed', 'Completed'
        FAILED = 'failed', 'Failed'

    profile = models.OneToOneField(
        FarmerProfile,
        on_delete=models.CASCADE,
        related_name='rotation_strategy',
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PROCESSING,
    )
    constraint_weights = models.JSONField(default=default_constraint_weights)
    structured_telemetry_payload = models.JSONField(default=dict, blank=True)
    ai_alerts = models.JSONField(default=list, blank=True)
    strategies_matrix = models.JSONField(default=dict, blank=True)
    used_fallback = models.BooleanField(default=False)
    model_used = models.CharField(max_length=64, blank=True, default='')
    error_message = models.TextField(blank=True, default='')
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        verbose_name = 'Rotation Strategy Report'
        verbose_name_plural = 'Rotation Strategy Reports'

    def __str__(self) -> str:
        return f'Rotation Strategy for {self.profile.full_name or self.profile.name} ({self.status})'
