from django.urls import path

from . import agri_views, views

urlpatterns = [
    path('module3/strategy/', views.module3_strategy_view, name='module3-strategy'),
    path('module3/recalculate/', views.module3_recalculate_view, name='module3-recalculate'),

    # Agri FPO Command Dashboard
    path('dashboard/metrics', agri_views.dashboard_metrics_view, name='agri-dashboard-metrics'),
    path('dashboard/metrics/', agri_views.dashboard_metrics_view, name='agri-dashboard-metrics-slash'),
    path('dashboard/weather-forecast', agri_views.dashboard_weather_forecast_view, name='agri-weather-forecast'),
    path('dashboard/weather-forecast/', agri_views.dashboard_weather_forecast_view, name='agri-weather-forecast-slash'),
    path('dashboard/plots-heatmap', agri_views.dashboard_plots_heatmap_view, name='agri-plots-heatmap'),
    path('dashboard/plots-heatmap/', agri_views.dashboard_plots_heatmap_view, name='agri-plots-heatmap-slash'),
    path('dashboard/yield-spline', agri_views.dashboard_yield_spline_view, name='agri-yield-spline'),
    path('dashboard/yield-spline/', agri_views.dashboard_yield_spline_view, name='agri-yield-spline-slash'),
    path('dashboard/alerts', agri_views.dashboard_alerts_view, name='agri-alerts'),
    path('dashboard/alerts/', agri_views.dashboard_alerts_view, name='agri-alerts-slash'),
    path('dashboard/broadcast', agri_views.dashboard_broadcast_view, name='agri-broadcast'),
    path('dashboard/broadcast/', agri_views.dashboard_broadcast_view, name='agri-broadcast-slash'),

    # Agri Module 1: One-Tap Satellite Field Profiler & ML Crop Engine
    path('field-profile', agri_views.field_profile_view, name='agri-field-profile'),
    path('field-profile/', agri_views.field_profile_view, name='agri-field-profile-slash'),
    path('predict-crop', agri_views.predict_crop_view, name='agri-predict-crop'),
    path('predict-crop/', agri_views.predict_crop_view, name='agri-predict-crop-slash'),

    # Agri Module 2: 3-Season Field Shift Simulator & Sentinel-2 NDVI Decline Check
    path('simulate-rotation', agri_views.simulate_rotation_view, name='agri-simulate-rotation'),
    path('simulate-rotation/', agri_views.simulate_rotation_view, name='agri-simulate-rotation-slash'),
    path('ndvi-check', agri_views.ndvi_check_view, name='agri-ndvi-check'),
    path('ndvi-check/', agri_views.ndvi_check_view, name='agri-ndvi-check-slash'),

    # Agri AI Visual Diagnostics Scanner
    path('diagnostics/scan', agri_views.diagnostics_scan_view, name='agri-diagnostics-scan'),
    path('diagnostics/scan/', agri_views.diagnostics_scan_view, name='agri-diagnostics-scan-slash'),
    path('diagnostics/samples', agri_views.diagnostics_samples_view, name='agri-diagnostics-samples'),
    path('diagnostics/samples/', agri_views.diagnostics_samples_view, name='agri-diagnostics-samples-slash'),

    # Agri AI4Bharat Multilingual Voice Desk
    path('voice/process', agri_views.voice_process_view, name='agri-voice-process'),
    path('voice/process/', agri_views.voice_process_view, name='agri-voice-process-slash'),
    path('voice/chat', agri_views.voice_chat_view, name='agri-voice-chat'),
    path('voice/chat/', agri_views.voice_chat_view, name='agri-voice-chat-slash'),
    path('voice/samples', agri_views.voice_samples_view, name='agri-voice-samples'),
    path('voice/samples/', agri_views.voice_samples_view, name='agri-voice-samples-slash'),
    path('voice/tts', agri_views.voice_tts_view, name='agri-voice-tts'),
    path('voice/tts/', agri_views.voice_tts_view, name='agri-voice-tts-slash'),

    # Agri Farm & Farmer CRM
    path('crm/farmers', agri_views.crm_farmers_list_view, name='agri-crm-farmers'),
    path('crm/farmers/', agri_views.crm_farmers_list_view, name='agri-crm-farmers-slash'),
    path('crm/farmers/<int:farmer_id>', agri_views.crm_farmer_detail_view, name='agri-crm-farmer-detail'),
    path('crm/farmers/<int:farmer_id>/', agri_views.crm_farmer_detail_view, name='agri-crm-farmer-detail-slash'),

    # Agri Government Scheme Discoverability Wizard
    path('schemes', agri_views.schemes_list_view, name='agri-schemes'),
    path('schemes/', agri_views.schemes_list_view, name='agri-schemes-slash'),
    path('schemes/match', agri_views.schemes_match_view, name='agri-schemes-match'),
    path('schemes/match/', agri_views.schemes_match_view, name='agri-schemes-match-slash'),
]
