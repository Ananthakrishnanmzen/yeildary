from __future__ import annotations

import re
from decimal import Decimal

from django import forms
from django.contrib.auth import get_user_model
from django.contrib.auth.forms import PasswordResetForm, SetPasswordForm
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

from .models import FarmerProfile
from .services import normalize_phone_number

INPUT_CLASS = (
    'w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 '
    'text-sm text-slate-100 placeholder:text-slate-500 outline-none '
    'transition focus:border-lime-400/70 focus:bg-white/[0.06] '
    'focus:ring-2 focus:ring-lime-400/20'
)
SELECT_CLASS = f'{INPUT_CLASS} appearance-none pr-10'
CHECKBOX_CLASS = (
    'h-4 w-4 rounded border-white/20 bg-white/5 text-lime-400 '
    'focus:ring-2 focus:ring-lime-400/40 focus:ring-offset-0'
)
HIDDEN_CLASS = 'hidden'


class FarmerLoginForm(forms.Form):
    email = forms.CharField(
        label='Email or username',
        max_length=150,
        widget=forms.TextInput(
            attrs={
                'class': INPUT_CLASS,
                'placeholder': 'you@example.com or admin username',
                'autocomplete': 'username',
                'autofocus': True,
            }
        ),
    )
    password = forms.CharField(
        widget=forms.PasswordInput(
            attrs={
                'class': INPUT_CLASS,
                'placeholder': 'Enter your password',
                'autocomplete': 'current-password',
            }
        ),
    )
    remember_me = forms.BooleanField(
        required=False,
        widget=forms.CheckboxInput(attrs={'class': CHECKBOX_CLASS}),
    )


class FarmerSignupForm(forms.Form):
    user_type = forms.ChoiceField(
        choices=[('farmer', 'Farmer')],
        initial='farmer',
        widget=forms.Select(attrs={'class': SELECT_CLASS, 'id': 'id_user_type'}),
    )
    # Account / identity
    name = forms.CharField(
        max_length=150,
        widget=forms.TextInput(
            attrs={
                'class': INPUT_CLASS,
                'placeholder': 'e.g. Anitha Joseph',
                'autocomplete': 'name',
            }
        ),
    )
    email = forms.EmailField(
        max_length=150,
        widget=forms.EmailInput(
            attrs={
                'class': INPUT_CLASS,
                'placeholder': 'you@example.com',
                'autocomplete': 'email',
            }
        ),
    )
    phone_number = forms.CharField(
        max_length=20,
        widget=forms.TextInput(
            attrs={
                'class': INPUT_CLASS,
                'placeholder': '+919876543210',
                'autocomplete': 'tel',
                'inputmode': 'tel',
                'data-phone-input': 'true',
            }
        ),
    )
    # Farm location
    place_name = forms.CharField(
        max_length=255,
        required=False,
        widget=forms.HiddenInput(attrs={'id': 'id_place_name'}),
    )
    latitude = forms.DecimalField(
        max_digits=9,
        decimal_places=6,
        required=False,
        widget=forms.HiddenInput(attrs={'id': 'id_latitude'}),
    )
    longitude = forms.DecimalField(
        max_digits=9,
        decimal_places=6,
        required=False,
        widget=forms.HiddenInput(attrs={'id': 'id_longitude'}),
    )
    farm_area_acres = forms.DecimalField(
        max_digits=10,
        decimal_places=2,
        min_value=Decimal('0.01'),
        label='Farm area (acres)',
        widget=forms.NumberInput(
            attrs={
                'class': INPUT_CLASS,
                'placeholder': 'e.g. 2.5',
                'step': '0.01',
                'min': '0.01',
                'inputmode': 'decimal',
            }
        ),
    )
    crops_grown = forms.CharField(
        max_length=2000,
        widget=forms.TextInput(
            attrs={
                'class': INPUT_CLASS,
                'placeholder': 'e.g. Rice, Banana, Black pepper',
                'autocomplete': 'off',
            }
        ),
    )
    gender = forms.ChoiceField(
        choices=FarmerProfile.Gender.choices,
        widget=forms.Select(attrs={'class': SELECT_CLASS}),
    )
    age = forms.IntegerField(
        min_value=13,
        max_value=120,
        widget=forms.NumberInput(
            attrs={
                'class': INPUT_CLASS,
                'placeholder': 'e.g. 42',
                'min': '13',
                'max': '120',
                'inputmode': 'numeric',
            }
        ),
    )
    preferred_language = forms.ChoiceField(
        choices=FarmerProfile.Language.choices,
        initial=FarmerProfile.Language.ENGLISH,
        widget=forms.Select(attrs={'class': SELECT_CLASS}),
    )
    # Security
    password = forms.CharField(
        widget=forms.PasswordInput(
            attrs={
                'class': INPUT_CLASS,
                'placeholder': 'Create a strong password',
                'autocomplete': 'new-password',
            }
        ),
    )
    confirm_password = forms.CharField(
        widget=forms.PasswordInput(
            attrs={
                'class': INPUT_CLASS,
                'placeholder': 'Re-enter your password',
                'autocomplete': 'new-password',
            }
        ),
    )
    terms_accepted = forms.BooleanField(
        required=True,
        error_messages={
            'required': (
                'You must accept the Terms of Service and Privacy Policy '
                'to create an account.'
            )
        },
        widget=forms.CheckboxInput(attrs={'class': CHECKBOX_CLASS}),
    )

    def clean_user_type(self):
        user_type = self.cleaned_data['user_type']
        if user_type != 'farmer':
            raise forms.ValidationError('Only farmer accounts are available right now.')
        return user_type

    def clean_name(self):
        name = ' '.join(self.cleaned_data['name'].split())
        if len(name) < 2:
            raise forms.ValidationError('Enter your full name.')
        return name

    def clean_email(self):
        email = get_user_model().objects.normalize_email(
            self.cleaned_data['email'].strip().lower()
        )
        User = get_user_model()
        if User.objects.filter(email__iexact=email).exists():
            raise forms.ValidationError('An account with this email already exists.')
        if User.objects.filter(username__iexact=email).exists():
            raise forms.ValidationError('An account with this email already exists.')
        return email

    def clean_phone_number(self):
        try:
            phone_number = normalize_phone_number(self.cleaned_data['phone_number'])
        except ValidationError as exc:
            raise forms.ValidationError(exc.messages) from exc
        if FarmerProfile.objects.filter(phone_number=phone_number).exists():
            raise forms.ValidationError(
                'This phone number is already linked to another account.'
            )
        return phone_number

    def clean_crops_grown(self):
        raw = self.cleaned_data['crops_grown']
        crops: list[str] = []
        seen: set[str] = set()
        for part in re.split(r'[,;\n]+', raw):
            crop = ' '.join(part.split())
            if not crop:
                continue
            key = crop.casefold()
            if key in seen:
                continue
            if len(crop) > 80:
                raise forms.ValidationError(
                    'Each crop name must be 80 characters or fewer.'
                )
            seen.add(key)
            crops.append(crop)
        if not crops:
            raise forms.ValidationError('Add at least one crop you grow.')
        if len(crops) > 50:
            raise forms.ValidationError('List up to 50 crops.')
        return crops

    def clean_password(self):
        password = self.cleaned_data['password']
        user = get_user_model()(
            username=self.cleaned_data.get('email', ''),
            email=self.cleaned_data.get('email', ''),
            first_name=self.cleaned_data.get('name', ''),
        )
        try:
            validate_password(password, user=user)
        except ValidationError as exc:
            raise forms.ValidationError(exc.messages) from exc
        return password

    def clean(self):
        cleaned_data = super().clean()
        password = cleaned_data.get('password')
        confirm_password = cleaned_data.get('confirm_password')
        if password and confirm_password and password != confirm_password:
            self.add_error('confirm_password', 'The passwords do not match.')

        place_name = (cleaned_data.get('place_name') or '').strip()
        latitude = cleaned_data.get('latitude')
        longitude = cleaned_data.get('longitude')
        if not place_name or latitude is None or longitude is None:
            self.add_error(
                'place_name',
                'Search for and select a place so we can capture its coordinates.',
            )
        else:
            cleaned_data['place_name'] = place_name
            if not (Decimal('-90') <= latitude <= Decimal('90')):
                self.add_error('place_name', 'The selected latitude is invalid.')
            if not (Decimal('-180') <= longitude <= Decimal('180')):
                self.add_error('place_name', 'The selected longitude is invalid.')
        return cleaned_data


class FarmerPasswordResetForm(PasswordResetForm):
    email = forms.EmailField(
        max_length=150,
        widget=forms.EmailInput(
            attrs={
                'class': INPUT_CLASS,
                'placeholder': 'you@example.com',
                'autocomplete': 'email',
                'autofocus': True,
            }
        ),
    )


class FarmerSetPasswordForm(SetPasswordForm):
    new_password1 = forms.CharField(
        label='New password',
        widget=forms.PasswordInput(
            attrs={
                'class': INPUT_CLASS,
                'placeholder': 'Enter a new password',
                'autocomplete': 'new-password',
                'autofocus': True,
            }
        ),
    )
    new_password2 = forms.CharField(
        label='Confirm new password',
        widget=forms.PasswordInput(
            attrs={
                'class': INPUT_CLASS,
                'placeholder': 'Re-enter the new password',
                'autocomplete': 'new-password',
            }
        ),
    )
