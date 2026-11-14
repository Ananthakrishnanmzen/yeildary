from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .models import FarmerProfile
from .serializers import (
    EmailTokenObtainPairSerializer,
    FarmerProfileSerializer,
    RegisterSerializer,
)


class RegisterView(APIView):
    """POST /api/register/ — Register a farmer and save OSM geocoordinates."""

    permission_classes = [AllowAny]

    def post(self, request: Request) -> Response:
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        profile = serializer.save()

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
