from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import EmailTokenObtainPairView, HealthView, ProfileView, RegisterView

app_name = 'accounts'

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('register', RegisterView.as_view(), name='register_no_slash'),
    path('health/', HealthView.as_view(), name='health'),
    path('health', HealthView.as_view(), name='health_no_slash'),
    path('token/', EmailTokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token', EmailTokenObtainPairView.as_view(), name='token_obtain_pair_no_slash'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('token/refresh', TokenRefreshView.as_view(), name='token_refresh_no_slash'),
    path('profile/', ProfileView.as_view(), name='profile'),
    path('profile', ProfileView.as_view(), name='profile_no_slash'),
]
