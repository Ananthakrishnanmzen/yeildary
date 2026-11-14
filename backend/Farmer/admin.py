from django.contrib import admin

from .models import FarmerProfile, PhoneVerification


@admin.register(FarmerProfile)
class FarmerProfileAdmin(admin.ModelAdmin):
    list_display = (
        'name',
        'user_email',
        'phone_number',
        'phone_verified',
        'place_name',
        'farm_area_acres',
        'preferred_language',
        'created_at',
    )
    list_filter = ('phone_verified', 'gender', 'preferred_language', 'created_at')
    search_fields = (
        'name',
        'user__email',
        'user__username',
        'phone_number',
        'place_name',
        'crops_grown',
    )
    readonly_fields = ('created_at', 'updated_at', 'terms_accepted_at')
    autocomplete_fields = ('user',)

    @admin.display(description='Email', ordering='user__email')
    def user_email(self, obj):
        return obj.user.email or obj.user.username


@admin.register(PhoneVerification)
class PhoneVerificationAdmin(admin.ModelAdmin):
    list_display = (
        'phone_number',
        'session_key',
        'attempts',
        'expires_at',
        'consumed_at',
        'created_at',
    )
    list_filter = ('created_at', 'expires_at')
    search_fields = ('phone_number', 'session_key')
    readonly_fields = (
        'phone_number',
        'session_key',
        'code_hash',
        'expires_at',
        'attempts',
        'consumed_at',
        'created_at',
    )

    def has_add_permission(self, request):
        return False
