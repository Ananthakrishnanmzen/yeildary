from django.urls import path

from . import views

app_name = 'farmer'

urlpatterns = [
    # Entry point: the root URL opens the farmer login page.
    path('', views.farmer_login, name='login'),
    path('login/', views.farmer_login, name='login_page'),
    path('signup/', views.farmer_signup, name='signup'),
    path('logout/', views.farmer_logout, name='logout'),
    path('dashboard/', views.farmer_dashboard, name='dashboard'),
    path(
        'researcher/',
        views.ResearcherPlaceholderView.as_view(),
        name='researcher_placeholder',
    ),
    # Farmer SMS / Firebase phone verification.
    path('api/phone/send-code/', views.phone_send_code, name='phone_send_code'),
    path('api/phone/verify-code/', views.phone_verify_code, name='phone_verify_code'),
    path(
        'api/phone/verify-firebase/',
        views.phone_verify_firebase,
        name='phone_verify_firebase',
    ),
    # Password reset (email link uses the console backend in development).
    path(
        'password-reset/',
        views.FarmerPasswordResetView.as_view(),
        name='password_reset',
    ),
    path(
        'password-reset/done/',
        views.FarmerPasswordResetDoneView.as_view(),
        name='password_reset_done',
    ),
    path(
        'reset/<uidb64>/<token>/',
        views.FarmerPasswordResetConfirmView.as_view(),
        name='password_reset_confirm',
    ),
    path(
        'reset/done/',
        views.FarmerPasswordResetCompleteView.as_view(),
        name='password_reset_complete',
    ),
    # Consent pages linked from signup.
    path(
        'terms/',
        views.LegalView.as_view(
            extra_context={
                'title': 'Terms of Service',
                'heading': 'Terms of Service',
                'summary': (
                    'Yieldary AI provides climate and farm advisories for '
                    'informational purposes. You are responsible for the '
                    'accuracy of the farm details you submit.'
                ),
            }
        ),
        name='terms',
    ),
    path(
        'privacy/',
        views.LegalView.as_view(
            extra_context={
                'title': 'Privacy Policy',
                'heading': 'Privacy Policy',
                'summary': (
                    'We store your account details and farm profile to provide '
                    'the Yieldary AI dashboard. Your phone number is used for '
                    'account verification and is never shown publicly.'
                ),
            }
        ),
        name='privacy',
    ),
]
