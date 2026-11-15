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
    # Farmer SMS / Firebase phone verification & email OTP verification.
    path('api/phone/send-code/', views.phone_send_code, name='phone_send_code'),
    path('api/phone/send-code', views.phone_send_code, name='phone_send_code_no_slash'),
    path('api/phone/verify-code/', views.phone_verify_code, name='phone_verify_code'),
    path('api/phone/verify-code', views.phone_verify_code, name='phone_verify_code_no_slash'),
    path(
        'api/phone/verify-firebase/',
        views.phone_verify_firebase,
        name='phone_verify_firebase',
    ),
    path(
        'api/phone/verify-firebase',
        views.phone_verify_firebase,
        name='phone_verify_firebase_no_slash',
    ),
    path('api/farmer/signup/', views.farmer_signup_api, name='farmer_signup_api'),
    path('api/farmer/signup', views.farmer_signup_api, name='farmer_signup_api_no_slash'),
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
