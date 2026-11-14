from django.db import models

from accounts.models import FarmerProfile


class FieldTelemetry(models.Model):
    """Stores Module 1 climate & vulnerability stress reports linked to a FarmerProfile."""

    farmer = models.OneToOneField(
        FarmerProfile,
        on_delete=models.CASCADE,
        related_name='telemetry',
        null=True,
        blank=True,
    )
    location_id = models.CharField(max_length=255, unique=True, null=True, blank=True, db_index=True)
    location_name = models.CharField(max_length=255, blank=True, default='')
    latitude = models.FloatField(null=True, blank=True)
    longitude = models.FloatField(null=True, blank=True)
    territory_mode = models.CharField(max_length=255, blank=True, default='')
    start_date = models.CharField(max_length=32, default='2020-01-01')
    end_date = models.CharField(max_length=32, blank=True, default='')
    polygon_coords = models.JSONField(default=list, blank=True)
    summary_metrics = models.JSONField(default=dict, blank=True)
    climate_fallback = models.JSONField(default=dict, blank=True)
    vulnerability_stress_layer = models.JSONField(default=dict, blank=True)
    raw_report = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        verbose_name = 'Field Telemetry'
        verbose_name_plural = 'Field Telemetry Reports'

    def __str__(self) -> str:
        if self.farmer_id:
            return f'Telemetry for {self.farmer.full_name} ({self.latitude}, {self.longitude})'
        return f'{self.location_name or self.location_id}'
