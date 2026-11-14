from django.contrib import admin

from .models import FarmerProfile


@admin.register(FarmerProfile)
class FarmerProfileAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'user', 'location_name', 'latitude', 'longitude', 'created_at')
    search_fields = ('full_name', 'user__email', 'location_name')
