import logging
import threading

from django.db import transaction
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from telemetry.views import compute_and_save_farmer_telemetry
from terrain.views import compute_and_save_farmer_terrain

from .models import FarmerProfile
from .serializers import (
    EmailTokenObtainPairSerializer,
    FarmerProfileSerializer,
    RegisterSerializer,
)

logger = logging.getLogger(__name__)


def _precompute_modules_async(profile_id: int) -> None:
    try:
        profile = FarmerProfile.objects.get(pk=profile_id)
    except FarmerProfile.DoesNotExist:
        return
    try:
        compute_and_save_farmer_telemetry(profile)
    except Exception:
        logger.exception('Background Module 1 telemetry precomputation failed for farmer %s', profile_id)
    try:
        compute_and_save_farmer_terrain(profile)
    except Exception:
        logger.exception('Background Module 2 terrain precomputation failed for farmer %s', profile_id)


class RegisterView(APIView):
    """POST /api/register/ — Register a farmer and save OSM geocoordinates."""

    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = serializer.save()

        transaction.on_commit(
            lambda: threading.Thread(
                target=_precompute_modules_async,
                args=(profile.pk,),
                daemon=True,
            ).start()
        )

        refresh = RefreshToken.for_user(profile.user)
        return Response(
            {
                'message': 'Farmer registered successfully.',
                'profile': FarmerProfileSerializer(profile).data,
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            },
            status=status.HTTP_201_CREATED,
        )


class EmailTokenObtainPairView(TokenObtainPairView):
    """POST /api/token/ — Issue JWT access and refresh tokens."""

    serializer_class = EmailTokenObtainPairSerializer


class ProfileView(APIView):
    """GET /api/profile/ — Return the authenticated farmer's profile details."""

    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        try:
            profile = request.user.farmer_profile
        except FarmerProfile.DoesNotExist:
            return Response(
                {'detail': 'Farmer profile not found for this account.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(FarmerProfileSerializer(profile).data, status=status.HTTP_200_OK)
