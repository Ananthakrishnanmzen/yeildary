from django.db import models

from accounts.models import FarmerProfile


class SoilAndErosion(models.Model):
    """Stores Module 2 terrain erosion risk and soil capability linked to a FarmerProfile."""

    farmer = models.OneToOneField(
        FarmerProfile,
        on_delete=models.CASCADE,
        related_name='soil_health',
    )
    erosion_risk_score = models.FloatField(null=True, blank=True)
    raw_slope_degrees = models.FloatField(null=True, blank=True)
    raw_rainfall_mm = models.FloatField(null=True, blank=True)
    tree_cover_pct = models.FloatField(null=True, blank=True)
    exposed_cover_pct = models.FloatField(null=True, blank=True)
    canopy_height_m = models.FloatField(null=True, blank=True)
    canopy_status = models.CharField(max_length=150, blank=True, default='')
    dynamic_description = models.TextField(blank=True, default='')
    soil_type = models.CharField(max_length=100, blank=True, default='')
    analyzed_from = models.CharField(max_length=32, blank=True, default='')
    analyzed_to = models.CharField(max_length=32, blank=True, default='')
    raw_report = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-updated_at']
        verbose_name = 'Soil & Erosion Report'
        verbose_name_plural = 'Soil & Erosion Reports'

    def __str__(self) -> str:
        return f'Soil & Erosion for {self.farmer.full_name} (Score: {self.erosion_risk_score})'
