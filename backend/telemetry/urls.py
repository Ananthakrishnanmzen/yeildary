from django.urls import path

from .views import FarmerTelemetryView
from .services.telemetry_engine import search_osm_location, reverse_geocode_osm

app_name = 'telemetry'

urlpatterns = [
    path('telemetry/', FarmerTelemetryView.as_view(), name='farmer_telemetry'),
    path('location/search/', search_osm_location, name='location_search'),
    path('location/reverse/', reverse_geocode_osm, name='location_reverse'),
]
