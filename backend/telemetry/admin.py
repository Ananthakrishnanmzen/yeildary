from django.contrib import admin

from .models import FieldTelemetry


@admin.register(FieldTelemetry)
class FieldTelemetryAdmin(admin.ModelAdmin):
    list_display = ('farmer', 'location_name', 'latitude', 'longitude', 'territory_mode', 'updated_at')
    search_fields = ('location_name', 'farmer__full_name', 'farmer__user__email')
