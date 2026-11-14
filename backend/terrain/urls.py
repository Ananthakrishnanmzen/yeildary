from django.urls import path

from .views import FarmerTerrainView

app_name = 'terrain'

urlpatterns = [
    path('terrain/', FarmerTerrainView.as_view(), name='farmer_terrain'),
]
