from django.contrib import admin

from .models import RotationStrategyReport


@admin.register(RotationStrategyReport)
class RotationStrategyReportAdmin(admin.ModelAdmin):
    list_display = ('profile', 'status', 'used_fallback', 'model_used', 'updated_at')
    list_filter = ('status', 'used_fallback')
    search_fields = ('profile__full_name', 'profile__location_name', 'profile__user__email')
