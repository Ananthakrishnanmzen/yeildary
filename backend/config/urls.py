"""URL configuration for Yieldary backend."""

from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('accounts.urls')),
    path('api/', include('telemetry.urls')),
    path('api/', include('terrain.urls')),
]
