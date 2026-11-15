import logging
import threading

from django.db import connection, transaction
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


class HealthView(APIView):
    """GET /api/health/ — Liveness probe that also verifies the database.

    A Render web service whose database is expired, unreachable or unmigrated
    answers every data-backed request with an opaque 500, which the React app can
    only report as a generic failure. This endpoint makes that state explicit and
    doubles as the Render health check path.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request: Request) -> Response:
        try:
            with connection.cursor() as cursor:
                cursor.execute('SELECT 1')
                cursor.fetchone()
        except Exception:
            logger.exception('Database health check failed: server unreachable')
            return Response(
                {
                    'ok': False,
                    'database': 'unavailable',
                    'error': 'The database is not reachable. Check that DATABASE_URL '
                    'points to a live database.',
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        try:
            pending = _pending_migration_count()
        except Exception:
            logger.exception('Database health check failed: migrations unreadable')
            return Response(
                {
                    'ok': False,
                    'database': 'reachable',
                    'error': 'The database is reachable but not initialised. Run '
                    '"python manage.py migrate" against this service.',
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        if pending:
            logger.error('Database health check failed: %s pending migrations', pending)
            return Response(
                {
                    'ok': False,
                    'database': 'reachable',
                    'pending_migrations': pending,
                    'error': f'{pending} migration(s) are not applied. Run '
                    '"python manage.py migrate" against this service.',
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response({'ok': True, 'database': 'ok'}, status=status.HTTP_200_OK)


def _pending_migration_count() -> int:
    """Number of migrations that have not been applied to the current database.

    Raises if the ``django_migrations`` table itself is missing, which is what an
    initialised-but-unmigrated database looks like.
    """

    from django.db.migrations.executor import MigrationExecutor

    executor = MigrationExecutor(connection)
    plan = executor.migration_plan(executor.loader.graph.leaf_nodes())
    return len(plan)


class ProfileView(APIView):
    """GET /api/profile/ — Return the authenticated farmer's profile details, or Agri Field Profile when ?lat=&lon= are provided."""

    permission_classes = [IsAuthenticated]

    def get_permissions(self):
        if 'lat' in self.request.query_params and 'lon' in self.request.query_params:
            return [AllowAny()]
        return super().get_permissions()

    def get(self, request: Request) -> Response:
        if 'lat' in request.query_params and 'lon' in request.query_params:
            from rotation.services.agri_services import build_field_profile
            try:
                lat = float(request.query_params.get('lat', 9.8959))
                lon = float(request.query_params.get('lon', 76.7184))
            except (TypeError, ValueError):
                lat, lon = 9.8959, 76.7184
            return Response(build_field_profile(lat, lon), status=status.HTTP_200_OK)

        try:
            profile = request.user.farmer_profile
        except FarmerProfile.DoesNotExist:
            return Response(
                {'detail': 'Farmer profile not found for this account.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        return Response(FarmerProfileSerializer(profile).data, status=status.HTTP_200_OK)
