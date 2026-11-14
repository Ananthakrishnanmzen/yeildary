from django.urls import path

from .views import FarmerTelemetryView

app_name = 'telemetry'

urlpatterns = [
    path('telemetry/', FarmerTelemetryView.as_view(), name='farmer_telemetry'),
]
