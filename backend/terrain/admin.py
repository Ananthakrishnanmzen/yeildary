from django.contrib import admin

from .models import SoilAndErosion


@admin.register(SoilAndErosion)
class SoilAndErosionAdmin(admin.ModelAdmin):
    list_display = ('farmer', 'erosion_risk_score', 'soil_type', 'tree_cover_pct', 'updated_at')
    search_fields = ('farmer__full_name', 'farmer__user__email', 'soil_type')
