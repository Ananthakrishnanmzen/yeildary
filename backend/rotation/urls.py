from django.urls import path

from . import lomura_views, views

urlpatterns = [
    path('module3/strategy/', views.module3_strategy_view, name='module3-strategy'),
    path('module3/recalculate/', views.module3_recalculate_view, name='module3-recalculate'),

    # Lomura FPO Command Dashboard
    path('dashboard/metrics', lomura_views.dashboard_metrics_view, name='lomura-dashboard-metrics'),
    path('dashboard/metrics/', lomura_views.dashboard_metrics_view, name='lomura-dashboard-metrics-slash'),
    path('dashboard/weather-forecast', lomura_views.dashboard_weather_forecast_view, name='lomura-weather-forecast'),
    path('dashboard/weather-forecast/', lomura_views.dashboard_weather_forecast_view, name='lomura-weather-forecast-slash'),
    path('dashboard/plots-heatmap', lomura_views.dashboard_plots_heatmap_view, name='lomura-plots-heatmap'),
    path('dashboard/plots-heatmap/', lomura_views.dashboard_plots_heatmap_view, name='lomura-plots-heatmap-slash'),
    path('dashboard/yield-spline', lomura_views.dashboard_yield_spline_view, name='lomura-yield-spline'),
    path('dashboard/yield-spline/', lomura_views.dashboard_yield_spline_view, name='lomura-yield-spline-slash'),
    path('dashboard/alerts', lomura_views.dashboard_alerts_view, name='lomura-alerts'),
    path('dashboard/alerts/', lomura_views.dashboard_alerts_view, name='lomura-alerts-slash'),
    path('dashboard/broadcast', lomura_views.dashboard_broadcast_view, name='lomura-broadcast'),
    path('dashboard/broadcast/', lomura_views.dashboard_broadcast_view, name='lomura-broadcast-slash'),

    # Lomura Module 1: One-Tap Satellite Field Profiler & ML Crop Engine
    path('field-profile', lomura_views.field_profile_view, name='lomura-field-profile'),
    path('field-profile/', lomura_views.field_profile_view, name='lomura-field-profile-slash'),
    path('predict-crop', lomura_views.predict_crop_view, name='lomura-predict-crop'),
    path('predict-crop/', lomura_views.predict_crop_view, name='lomura-predict-crop-slash'),

    # Lomura Module 2: 3-Season Field Shift Simulator & Sentinel-2 NDVI Decline Check
    path('simulate-rotation', lomura_views.simulate_rotation_view, name='lomura-simulate-rotation'),
    path('simulate-rotation/', lomura_views.simulate_rotation_view, name='lomura-simulate-rotation-slash'),
    path('ndvi-check', lomura_views.ndvi_check_view, name='lomura-ndvi-check'),
    path('ndvi-check/', lomura_views.ndvi_check_view, name='lomura-ndvi-check-slash'),

    # Lomura AI Visual Diagnostics Scanner
    path('diagnostics/scan', lomura_views.diagnostics_scan_view, name='lomura-diagnostics-scan'),
    path('diagnostics/scan/', lomura_views.diagnostics_scan_view, name='lomura-diagnostics-scan-slash'),
    path('diagnostics/samples', lomura_views.diagnostics_samples_view, name='lomura-diagnostics-samples'),
    path('diagnostics/samples/', lomura_views.diagnostics_samples_view, name='lomura-diagnostics-samples-slash'),

    # Lomura AI4Bharat Multilingual Voice Desk
    path('voice/process', lomura_views.voice_process_view, name='lomura-voice-process'),
    path('voice/process/', lomura_views.voice_process_view, name='lomura-voice-process-slash'),
    path('voice/chat', lomura_views.voice_chat_view, name='lomura-voice-chat'),
    path('voice/chat/', lomura_views.voice_chat_view, name='lomura-voice-chat-slash'),
    path('voice/samples', lomura_views.voice_samples_view, name='lomura-voice-samples'),
    path('voice/samples/', lomura_views.voice_samples_view, name='lomura-voice-samples-slash'),
    path('voice/tts', lomura_views.voice_tts_view, name='lomura-voice-tts'),
    path('voice/tts/', lomura_views.voice_tts_view, name='lomura-voice-tts-slash'),

    # Lomura Farm & Farmer CRM
    path('crm/farmers', lomura_views.crm_farmers_list_view, name='lomura-crm-farmers'),
    path('crm/farmers/', lomura_views.crm_farmers_list_view, name='lomura-crm-farmers-slash'),
    path('crm/farmers/<int:farmer_id>', lomura_views.crm_farmer_detail_view, name='lomura-crm-farmer-detail'),
    path('crm/farmers/<int:farmer_id>/', lomura_views.crm_farmer_detail_view, name='lomura-crm-farmer-detail-slash'),

    # Lomura Government Scheme Discoverability Wizard
    path('schemes', lomura_views.schemes_list_view, name='lomura-schemes'),
    path('schemes/', lomura_views.schemes_list_view, name='lomura-schemes-slash'),
    path('schemes/match', lomura_views.schemes_match_view, name='lomura-schemes-match'),
    path('schemes/match/', lomura_views.schemes_match_view, name='lomura-schemes-match-slash'),
]
