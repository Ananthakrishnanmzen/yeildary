from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

from .models import FarmerProfile

User = get_user_model()


class FarmerProfileSerializer(serializers.ModelSerializer):
    """Serializes the authenticated farmer's profile details."""

    email = serializers.EmailField(source='user.email', read_only=True)
    latitude = serializers.FloatField()
    longitude = serializers.FloatField()

    class Meta:
        model = FarmerProfile
        fields = ('id', 'email', 'full_name', 'location_name', 'latitude', 'longitude', 'created_at')


class RegisterSerializer(serializers.Serializer):
    """Validates and creates a User + FarmerProfile with geocoded coordinates."""

    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=6)
    full_name = serializers.CharField(max_length=150)
    location_name = serializers.CharField(max_length=255)
    latitude = serializers.DecimalField(max_digits=9, decimal_places=6)
    longitude = serializers.DecimalField(max_digits=9, decimal_places=6)

    def validate_email(self, value: str) -> str:
        normalized = value.strip().lower()
        if User.objects.filter(email__iexact=normalized).exists() or User.objects.filter(
            username__iexact=normalized
        ).exists():
            raise serializers.ValidationError('A farmer with this email is already registered.')
        return normalized

    def validate_latitude(self, value):
        if value < -90 or value > 90:
            raise serializers.ValidationError('Latitude must be between -90 and 90.')
        return value

    def validate_longitude(self, value):
        if value < -180 or value > 180:
            raise serializers.ValidationError('Longitude must be between -180 and 180.')
        return value

    @transaction.atomic
    def create(self, validated_data: dict) -> FarmerProfile:
        email = validated_data['email']
        user = User.objects.create_user(
            username=email,
            email=email,
            password=validated_data['password'],
            first_name=validated_data['full_name'].strip(),
        )
        return FarmerProfile.objects.create(
            user=user,
            full_name=validated_data['full_name'].strip(),
            location_name=validated_data['location_name'].strip(),
            latitude=validated_data['latitude'],
            longitude=validated_data['longitude'],
        )


class EmailTokenObtainPairSerializer(TokenObtainPairSerializer):
    """Allows JWT login using `email` (or `username`) and `password`."""

    email = serializers.EmailField(required=False)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields[self.username_field].required = False

    def validate(self, attrs: dict) -> dict:
        email = attrs.get('email')
        username = attrs.get(self.username_field)
        password = attrs.get('password')

        identifier = (email or username or '').strip().lower()
        if not identifier or not password:
            raise serializers.ValidationError('Email and password are required.')

        user = authenticate(
            request=self.context.get('request'),
            username=identifier,
            password=password,
        )
        if user is None:
            raise serializers.ValidationError('Invalid email or password.')

        refresh = self.get_token(user)
        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token),
        }
