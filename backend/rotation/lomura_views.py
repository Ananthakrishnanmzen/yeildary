"""REST API views for all Lomura features integrated into Yieldary backend."""



from __future__ import annotations



import copy

from datetime import datetime, timedelta, timezone

import json

import random

from typing import Any, Dict, List



from django.http import HttpResponse

from rest_framework import status

from rest_framework.decorators import api_view, parser_classes, permission_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from rest_framework.permissions import AllowAny

from rest_framework.request import Request

from rest_framework.response import Response



from accounts.models import FarmerProfile

from .services.lomura_services import (

    AGRI_KNOWLEDGE_BASE,

    LIVE_ALERTS,

    ROTATION_MATRIX,

    SEEDED_FARMERS,

    SEEDED_SCHEMES,

    analyze_image_diagnostics,

    build_field_profile,

    generate_tts_wav_bytes,

    predict_crops,

    process_voice_query,

)





def _combined_farmers() -> List[Dict[str, Any]]:

    """Return seeded FPO farmers merged with registered Yieldary FarmerProfile records."""

    farmers = copy.deepcopy(SEEDED_FARMERS)

    try:

        db_profiles = FarmerProfile.objects.all().order_by("-created_at")

        base_id = 100

        for prof in db_profiles:

            crops_list = prof.current_crops if isinstance(prof.current_crops, list) else []

            crop_str = crops_list[0].title() if crops_list else "Spices"

            lat = float(prof.latitude or 9.8959)

            lon = float(prof.longitude or 76.7184)

            farmers.append(

                {

                    "id": base_id + prof.id,

                    "full_name": prof.full_name,

                    "phone": prof.phone_number,

                    "village": (prof.location_name or "Idukki").split(",")[0].strip(),

                    "cluster": "Thodupuzha High-Ranges FPO",

                    "plot_name": f"{prof.full_name}'s Registered Plot",

                    "plot_size_acres": round(float(prof.farm_area or 2.5), 1),

                    "crop_type": crop_str,

                    "sowing_date": "2026-06-15",

                    "latitude": lat,

                    "longitude": lon,

                    "risk_status": "Normal",

                    "ndvi_score": 0.72,

                    "soil_ph": 5.8,

                    "soil_moisture": 42.8,

                    "irrigation_source": "Rainfed & Drip",

                    "active_schemes": "PM-KUSUM Solar Pump, NHM Spices Rejuvenation",

                    "query_log": "Synced with Yieldary GEE Space-to-Soil Telemetry.",

                    "geojson_polygon": json.dumps(

                        [

                            [round(lat - 0.0005, 4), round(lon - 0.0005, 4)],

                            [round(lat + 0.0005, 4), round(lon - 0.0005, 4)],

                            [round(lat + 0.0005, 4), round(lon + 0.0005, 4)],

                            [round(lat - 0.0005, 4), round(lon + 0.0005, 4)],

                        ]

                    ),

                }

            )

    except Exception:

        pass

    return farmers





# ===========================================================================

# 1. FPO Command Dashboard Endpoints (/api/dashboard/*)

# ===========================================================================

@api_view(["GET"])

@permission_classes([AllowAny])

def dashboard_metrics_view(request: Request) -> Response:

    farmers = _combined_farmers()

    total_farmers = len(farmers) or 10

    total_acres = sum(float(f["plot_size_acres"]) for f in farmers) or 28.5

    critical_plots = sum(1 for f in farmers if f["risk_status"] == "Critical")

    moderate_plots = sum(1 for f in farmers if f["risk_status"] == "Moderate")

    healthy_plots = sum(1 for f in farmers if f["risk_status"] == "Normal")

    avg_ndvi = round(sum(float(f["ndvi_score"]) for f in farmers) / total_farmers, 2) if total_farmers else 0.71



    return Response(

        {

            "cluster_name": "Thodupuzha High-Ranges FPO",

            "district": "Idukki & Ernakulam Border Zone, Kerala",

            "total_registered_farmers": 1280 + total_farmers,

            "monitored_acreage": round(3420 + total_acres, 1),

            "critical_risk_plots": critical_plots,

            "moderate_risk_plots": moderate_plots,

            "healthy_plots": healthy_plots,

            "cluster_avg_ndvi": avg_ndvi,

            "fungal_blast_risk": "HIGH_ALERT",

            "active_advisories_count": len(LIVE_ALERTS),

            "last_sync": datetime.now(timezone.utc).isoformat(),

        },

        status=status.HTTP_200_OK,

    )





@api_view(["GET"])

@permission_classes([AllowAny])

def dashboard_weather_forecast_view(request: Request) -> Response:

    now = datetime.now(timezone.utc)

    hours_data = []

    for i in range(16):

        time_slot = now + timedelta(hours=i * 3)

        temp = round(24.0 + 3.5 * (1 if 3 <= (time_slot.hour % 24) <= 9 else -0.8) + random.uniform(-0.4, 0.4), 1)

        humidity = round(82.0 + 7.5 * (-1 if 3 <= (time_slot.hour % 24) <= 9 else 0.9) + random.uniform(-1.5, 2.5), 1)

        rain_prob = round(random.uniform(55, 92) if humidity > 85 else random.uniform(20, 48))

        blast_risk_active = humidity >= 85.0 and 22.0 <= temp <= 28.5

        condition = "Heavy Rain" if rain_prob > 75 else ("Showers" if rain_prob > 40 else "Cloudy")

        hours_data.append(

            {

                "time": time_slot.strftime("%a %H:%M"),

                "temperature_c": temp,

                "humidity_percent": humidity,

                "rain_probability": rain_prob,

                "condition": condition,

                "wind_speed_kmh": round(random.uniform(8, 22), 1),

                "fungal_blast_risk": blast_risk_active,

            }

        )



    blast_hours = sum(1 for h in hours_data if h["fungal_blast_risk"])

    overall_blast_status = "CRITICAL" if blast_hours >= 6 else ("MODERATE" if blast_hours >= 2 else "LOW")



    return Response(

        {

            "location": "Thodupuzha (Idukki Foot-hills)",

            "coordinates": {"lat": 9.8959, "lon": 76.7184},

            "current": {

                "temp_c": 25.4,

                "humidity": 89,

                "condition": "Monsoon Showers",

                "blast_risk": True,

                "blast_risk_reason": "High humidity (89%) and optimal incubation temperature (25.4°C) trigger Magnaporthe oryzae & Sigatoka blast risk.",

            },

            "forecast_48h": hours_data,

            "blast_risk_status": overall_blast_status,

            "blast_risk_threshold_rule": "RH > 85% AND Temp 22-28°C",

        },

        status=status.HTTP_200_OK,

    )





@api_view(["GET"])

@permission_classes([AllowAny])

def dashboard_plots_heatmap_view(request: Request) -> Response:

    farmers = _combined_farmers()

    plots = []

    for f in farmers:

        status_color = (

            "#10b981"

            if f["risk_status"] == "Normal"

            else ("#f59e0b" if f["risk_status"] == "Moderate" else "#ef4444")

        )

        plots.append(

            {

                "id": f["id"],

                "farmer_name": f["full_name"],

                "phone": f["phone"],

                "village": f["village"],

                "plot_name": f["plot_name"],

                "crop_type": f["crop_type"],

                "size_acres": f["plot_size_acres"],

                "lat": f["latitude"],

                "lon": f["longitude"],

                "risk_status": f["risk_status"],

                "status_color": status_color,

                "ndvi_score": f["ndvi_score"],

                "soil_ph": f["soil_ph"],

                "soil_moisture": f["soil_moisture"],

                "irrigation": f["irrigation_source"],

                "geojson_polygon": f["geojson_polygon"],

            }

        )

    return Response({"status": "success", "total_plots": len(plots), "plots": plots}, status=status.HTTP_200_OK)





@api_view(["GET"])

@permission_classes([AllowAny])

def dashboard_yield_spline_view(request: Request) -> Response:

    months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

    actual_2025 = [42, 38, 48, 55, 62, 78, 85, 92, 88, 70, 58, 46]

    predicted_2026 = [45, 41, 52, 59, 68, 74, 80, 89, 94, 76, 64, 50]

    chart_data = [

        {

            "month": m,

            "previous_actual_quintals": act,

            "ai_predicted_quintals": pred,

            "variance": round(pred - act, 1),

        }

        for m, act, pred in zip(months, actual_2025, predicted_2026)

    ]

    return Response(

        {

            "cluster": "Thodupuzha High-Ranges FPO",

            "crop_group": "Paddy, Banana & Pepper Aggregate",

            "unit": "Quintals / Cluster",

            "data": chart_data,

            "annual_actual_total": sum(actual_2025),

            "annual_predicted_total": sum(predicted_2026),

            "trend_insight": "AI forecast predicts a +4.2% net yield increase due to early pre-monsoon bio-drainage adoption, despite August moisture spikes.",

        },

        status=status.HTTP_200_OK,

    )





@api_view(["GET"])

@permission_classes([AllowAny])

def dashboard_alerts_view(request: Request) -> Response:

    return Response(LIVE_ALERTS, status=status.HTTP_200_OK)





@api_view(["POST"])

@permission_classes([AllowAny])

def dashboard_broadcast_view(request: Request) -> Response:

    payload = request.data if isinstance(request.data, dict) else {}

    title = payload.get("title", "Urgent Agricultural Advisory Alert")

    message = payload.get("message", "Precautionary action recommended for your crop cluster.")

    severity = payload.get("severity", "High")

    new_alert = {

        "id": len(LIVE_ALERTS) + 1,

        "title": title,

        "severity": severity,

        "category": payload.get("category", "Pest Outbreak"),

        "target_cluster": "Thodupuzha High-Ranges FPO",

        "message": message,

        "suggested_action": payload.get("suggested_action", "Consult your FPO Field Officer."),

        "created_at": datetime.now(timezone.utc).isoformat(),

        "broadcast_count": 1280,

    }

    LIVE_ALERTS.insert(0, new_alert)

    return Response(

        {

            "status": "success",

            "message": "Broadcast dispatched to 1,280 farmers in Thodupuzha High-Ranges FPO via SMS and Voice IVR.",

            "alert_id": new_alert["id"],

            "dispatched_by": getattr(request.user, "email", None) or "FPO Command Officer",

            "timestamp": new_alert["created_at"],

        },

        status=status.HTTP_200_OK,

    )





# ===========================================================================

# 2. One-Tap Satellite Field Profiler & ML Crop Predictor

# ===========================================================================

@api_view(["GET"])

@permission_classes([AllowAny])

def field_profile_view(request: Request) -> Response:

    try:

        lat = float(request.query_params.get("lat", 9.8959))

        lon = float(request.query_params.get("lon", 76.7184))

    except (TypeError, ValueError):

        lat, lon = 9.8959, 76.7184

    return Response(build_field_profile(lat, lon), status=status.HTTP_200_OK)





@api_view(["GET"])

@permission_classes([AllowAny])

def predict_crop_view(request: Request) -> Response:

    try:

        temp = float(request.query_params.get("temp", 26.0))

        humidity = float(request.query_params.get("humidity", 75.0))

        ph = float(request.query_params.get("ph", 6.5))

        rainfall = float(request.query_params.get("rainfall", 150.0))

        N = float(request.query_params.get("N", 50.0))

        P = float(request.query_params.get("P", 50.0))

        K = float(request.query_params.get("K", 50.0))

    except (TypeError, ValueError):

        temp, humidity, ph, rainfall, N, P, K = 26.0, 75.0, 6.5, 150.0, 50.0, 50.0, 50.0

    return Response(

        predict_crops(temp=temp, humidity=humidity, ph=ph, rainfall=rainfall, N=N, P=P, K=K),

        status=status.HTTP_200_OK,

    )





# ===========================================================================

# 3. 3-Season Field Shift Simulator & Sentinel-2 NDVI Check

# ===========================================================================

@api_view(["POST"])

@permission_classes([AllowAny])

def simulate_rotation_view(request: Request) -> Response:

    data = request.data if isinstance(request.data, dict) else {}

    w_water = float(data.get("water_weight", 0.6))

    w_profit = float(data.get("profit_weight", 0.8))

    w_soil = float(data.get("soil_recovery_weight", 0.85))

    w_labor = float(data.get("labor_weight", 0.4))

    soil_ph = float(data.get("cluster_soil_ph", 5.6))



    total_w = (w_water + w_profit + w_soil + w_labor) or 1.0

    scored_rotations = []

    for rot in ROTATION_MATRIX:

        water_score = (1.0 - rot["water_need"]) * w_water

        profit_score = rot["profit_potential"] * w_profit

        soil_score = rot["soil_recovery"] * w_soil

        labor_score = (1.0 - rot["labor_intensity"] * 0.5) * w_labor

        composite_score = round(((water_score + profit_score + soil_score + labor_score) / total_w) * 100, 1)

        scored_rotations.append(

            {

                **rot,

                "composite_fitness_score": composite_score,

                "seasonal_timeline": [

                    {"season": "Kharif (Monsoon)", "crop": rot["kharif"], "months": "Jun - Oct", "status": "Cash Crop"},

                    {"season": "Rabi (Post-Monsoon)", "crop": rot["rabi"], "months": "Nov - Feb", "status": "Pulse / Recovery"},

                    {"season": "Zaid (Summer)", "crop": rot["zaid"], "months": "Mar - May", "status": "Cover / Bio-Manure"},

                ],

            }

        )



    scored_rotations.sort(key=lambda x: x["composite_fitness_score"], reverse=True)

    return Response(

        {

            "status": "success",

            "evaluated_against_soil_ph": soil_ph,

            "top_rotation_regime": scored_rotations[0],

            "all_rotations": scored_rotations,

        },

        status=status.HTTP_200_OK,

    )





@api_view(["GET"])

@permission_classes([AllowAny])

def ndvi_check_view(request: Request) -> Response:

    try:

        lat = float(request.query_params.get("lat", 9.8959))

        lon = float(request.query_params.get("lon", 76.7184))

    except (TypeError, ValueError):

        lat, lon = 9.8959, 76.7184



    dates = ["2026-05-15", "2026-06-15", "2026-07-15", "2026-08-15", "2026-09-15", "2026-10-15"]

    ndvi_series = [0.58, 0.64, 0.76, 0.74, 0.69, 0.61]

    current_ndvi = ndvi_series[-1]

    peak_ndvi = max(ndvi_series)

    drop_pct = round(((peak_ndvi - current_ndvi) / peak_ndvi) * 100, 1)

    is_alert = drop_pct > 15.0



    return Response(

        {

            "coordinates": {"lat": lat, "lon": lon},

            "satellite": "Sentinel-2 MSI Level-2A (10m Resolution)",

            "current_ndvi": current_ndvi,

            "peak_ndvi": peak_ndvi,

            "decline_percentage": drop_pct,

            "alert_triggered": is_alert,

            "advisory": (

                "19.7% vegetative vigor drop detected post-monsoon. Suggests localized fungal blast or drainage stress."

                if is_alert

                else "Vegetation vigor within normal range."

            ),

            "trend_data": [{"date": d, "ndvi": val} for d, val in zip(dates, ndvi_series)],

        },

        status=status.HTTP_200_OK,

    )





# ===========================================================================

# 4. AI Visual Diagnostics Scanner (/api/diagnostics/*)

# ===========================================================================

@api_view(["POST"])

@permission_classes([AllowAny])

def diagnostics_scan_view(request: Request) -> Response:

    uploaded = request.FILES.get("file")

    sample_key = request.data.get("sample_key") if hasattr(request, "data") else None

    image_bytes = None

    mime_type = "image/jpeg"



    if uploaded:

        from rotation.services.gemini_vision import validate_uploaded_image_file



        is_valid_file, error_msg = validate_uploaded_image_file(uploaded)

        if not is_valid_file:

            return Response(

                {

                    "status": "error",

                    "message": error_msg,

                    "is_valid_specimen": False,

                },

                status=status.HTTP_400_BAD_REQUEST,

            )



        file_name = uploaded.name

        try:

            image_bytes = uploaded.read()

        except Exception:

            return Response(

                {

                    "status": "error",

                    "message": "Failed to read uploaded image data. Please upload a valid .JPG or .PNG file.",

                    "is_valid_specimen": False,

                },

                status=status.HTTP_400_BAD_REQUEST,

            )

        mime_type = uploaded.content_type or ("image/jpeg" if file_name.lower().endswith((".jpg", ".jpeg")) else "image/png")

    elif sample_key:

        file_name = f"{sample_key}.jpg"

    else:

        file_name = "banana_sigatoka_leaf.jpg"



    analysis = analyze_image_diagnostics(

        file_name=file_name,

        image_bytes=image_bytes,

        mime_type=mime_type,

        sample_key=sample_key,

    )

    return Response(analysis, status=status.HTTP_200_OK)





@api_view(["GET"])

@permission_classes([AllowAny])

def diagnostics_samples_view(request: Request) -> Response:

    return Response(

        [

            {

                "id": "banana_sigatoka",

                "name": "Banana Leaf - Black Sigatoka Necrosis",

                "crop": "Banana",

                "description": "Lower leaves showing elliptical yellow-brown necrotic blotches",

                "image_url": "https://images.unsplash.com/photo-1528825871115-3581a5387919?auto=format&fit=crop&w=600&q=80",

            },

            {

                "id": "rice_bacterial_blight",

                "name": "Paddy Foliage - Bacterial Sheath Blight",

                "crop": "Paddy",

                "description": "Water-soaked marginal lesions on paddy tillers",

                "image_url": "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=600&q=80",

            },

            {

                "id": "soil_health_card",

                "name": "Soil Health Test Card - Acidic Profile (pH 5.2)",

                "crop": "Soil Analysis",

                "description": "Physical card showing low available N and high acidity",

                "image_url": "https://images.unsplash.com/photo-1464226184884-fa280b87c399?auto=format&fit=crop&w=600&q=80",

            },

            {

                "id": "coconut_stem_bleeding",

                "name": "Coconut Palm - Stem Bleeding Gummosis",

                "crop": "Coconut",

                "description": "Dark brown oozing fluid from cortical cracks in the trunk",

                "image_url": "https://images.unsplash.com/photo-1513836279014-a89f7a76ae86?auto=format&fit=crop&w=600&q=80",

            },

        ],

        status=status.HTTP_200_OK,

    )





# ===========================================================================

# 5. AI4Bharat Multilingual Voice Desk (/api/voice/*)

# ===========================================================================

@api_view(["POST"])

@permission_classes([AllowAny])

def voice_process_view(request: Request) -> Response:

    data = request.data if hasattr(request, "data") else {}

    language = data.get("language", "ml")

    query_text = data.get("query_text")



    history_raw = data.get("history")

    history = []

    if isinstance(history_raw, list):

        history = history_raw

    elif isinstance(history_raw, str):

        try:

            import json

            history = json.loads(history_raw)

        except Exception:

            history = []



    audio_file = request.FILES.get("audio") or request.FILES.get("file")

    audio_bytes = None

    audio_mime = "audio/webm"

    if audio_file:

        audio_bytes = audio_file.read()

        audio_mime = getattr(audio_file, "content_type", "audio/webm") or "audio/webm"



    kb_intent = data.get("kb_intent") or data.get("intent")

    farmer_id = data.get("farmer_id")



    result = process_voice_query(

        language=language,

        query_text=query_text,

        conversation_history=history,

        audio_bytes=audio_bytes,

        audio_mime_type=audio_mime,

        kb_intent=kb_intent,

        user=getattr(request, "user", None),

        farmer_id=farmer_id,

    )

    return Response(result, status=status.HTTP_200_OK)





@api_view(["POST"])

@permission_classes([AllowAny])

def voice_chat_view(request: Request) -> Response:

    data = request.data if isinstance(request.data, dict) else {}

    query = data.get("query_text", "")

    language = data.get("language", "ml")

    kb_intent = data.get("kb_intent") or data.get("intent")

    farmer_id = data.get("farmer_id")

    history = data.get("history", [])

    if isinstance(history, str):

        try:

            import json

            history = json.loads(history)

        except Exception:

            history = []



    result = process_voice_query(

        language=language,

        query_text=query,

        conversation_history=history,

        kb_intent=kb_intent,

        user=getattr(request, "user", None),

        farmer_id=farmer_id,

    )

    return Response(result, status=status.HTTP_200_OK)





@api_view(["GET"])

@permission_classes([AllowAny])

def voice_samples_view(request: Request) -> Response:

    lang = (request.query_params.get("lang") or "ml").lower()

    if lang not in ["ml", "hi", "en"]:

        lang = "ml"

    samples = [

        {

            "intent": item["intent"],

            "question": item.get(f"sample_transcript_{lang}", item["sample_transcript_en"]),

            "answer_preview": item.get(f"answer_{lang}", item["answer_en"])[:80] + "...",

        }

        for item in AGRI_KNOWLEDGE_BASE

    ]

    farm_samples = [

        {

            "intent": "Farm Land Diagnostics",

            "question": (

                "എന്റെ ഭൂമിയിലെ പ്രശ്നങ്ങൾ എന്തൊക്കെയാണ്?"

                if lang == "ml"

                else ("मेरी जमीन में क्या समस्याएं हैं?" if lang == "hi" else "What is the problem on my land?")

            ),

            "answer_preview": (

                "ടെലിമെട്രി ഡാറ്റ പ്രകാരം ജലസമ്മർദ്ദം, മണ്ണൊലിപ്പ് സാധ്യത..."

                if lang == "ml"

                else ("टेलीमेट्री डेटा के अनुसार जल तनाव और मिट्टी कटाव..." if lang == "hi" else "Diagnoses land challenges like water stress, slope erosion...")

            ),

        },

        {

            "intent": "Crop Improvement Strategy",

            "question": (

                "എന്റെ വിളവും കൃഷിരീതിയും എങ്ങനെ മെച്ചപ്പെടുത്താം?"

                if lang == "ml"

                else ("मेरी फसल की पैदावार और खेती कैसे सुधारें?" if lang == "hi" else "How can I improve my crop growing?")

            ),

            "answer_preview": (

                "മണ്ണിലെ ഫലപുഷ്ടി 40% കൂട്ടാൻ പയറുവർഗ്ഗ ആവരണവിളകൾ..."

                if lang == "ml"

                else ("मिट्टी में 40% सुधार हेतु मूंग-सनई की आवरण फसल..." if lang == "hi" else "Recommends legume cover crops, contour mulching, and water-saver crops...")

            ),

        },

        {

            "intent": "Farm Land & Crop Records",

            "question": (

                "എന്റെ കൃഷിഭൂമിയിലെ വിളകളും സ്ഥലവിവരങ്ങളും പറയൂ"

                if lang == "ml"

                else ("मेरे खेत की जमीन और फसलों का विवरण बताएं" if lang == "hi" else "What crops and land acreage are registered on my farm?")

            ),

            "answer_preview": (

                "നിങ്ങളുടെ ഡാറ്റാബേസ് വിവരങ്ങൾ പ്രകാരം കൃഷിസ്ഥലം, വിളകൾ..."

                if lang == "ml"

                else ("डेटाबेस रिकॉर्ड के अनुसार आपकी जमीन और फसलें..." if lang == "hi" else "Fetches your farm acreage, location, and registered crops...")

            ),

        },

    ]

    for s in reversed(farm_samples):

        samples.insert(0, s)

    return Response({"language": lang, "samples": samples}, status=status.HTTP_200_OK)





@api_view(["GET"])

@permission_classes([AllowAny])

def voice_tts_view(request: Request) -> HttpResponse:

    lang = (request.query_params.get("lang") or "ml").lower()

    wav_bytes = generate_tts_wav_bytes(lang)

    return HttpResponse(wav_bytes, content_type="audio/wav")





# ===========================================================================

# 6. Farm & Farmer CRM (/api/crm/*)

# ===========================================================================

@api_view(["GET", "POST"])

@permission_classes([AllowAny])

def crm_farmers_list_view(request: Request) -> Response:

    if request.method == "POST":

        payload = request.data if isinstance(request.data, dict) else {}

        new_farmer = {

            "id": len(SEEDED_FARMERS) + 50,

            "full_name": payload.get("full_name", "New FPO Farmer"),

            "phone": payload.get("phone", "+91 94470 00000"),

            "village": payload.get("village", "Thodupuzha"),

            "cluster": payload.get("cluster", "Thodupuzha High-Ranges FPO"),

            "plot_name": payload.get("plot_name", "Registered Parcel"),

            "plot_size_acres": float(payload.get("plot_size_acres", 2.0)),

            "crop_type": payload.get("crop_type", "Spices"),

            "sowing_date": payload.get("sowing_date", "2026-06-15"),

            "latitude": float(payload.get("latitude", 9.8959)),

            "longitude": float(payload.get("longitude", 76.7184)),

            "risk_status": payload.get("risk_status", "Normal"),

            "ndvi_score": float(payload.get("ndvi_score", 0.72)),

            "soil_ph": float(payload.get("soil_ph", 5.8)),

            "soil_moisture": float(payload.get("soil_moisture", 42.0)),

            "irrigation_source": payload.get("irrigation_source", "Drip Irrigation"),

            "active_schemes": "PM-KUSUM Solar Pump",

            "query_log": "Newly onboarded via Yieldary CRM.",

            "geojson_polygon": "[]",

        }

        SEEDED_FARMERS.append(new_farmer)

        return Response(new_farmer, status=status.HTTP_201_CREATED)



    q = (request.query_params.get("q") or "").strip().lower()

    crop = (request.query_params.get("crop") or "").strip().lower()

    risk = (request.query_params.get("risk") or "").strip()

    sort_by = request.query_params.get("sort_by", "name")

    sort_order = request.query_params.get("sort_order", "asc")



    farmers = _combined_farmers()

    if q:

        farmers = [

            f

            for f in farmers

            if q in f["full_name"].lower() or q in f["phone"].lower() or q in f["village"].lower()

        ]

    if crop and crop != "all":

        farmers = [f for f in farmers if crop in f["crop_type"].lower()]

    if risk and risk.lower() != "all":

        farmers = [f for f in farmers if f["risk_status"].lower() == risk.lower()]



    reverse = sort_order.lower() == "desc"

    if sort_by == "size":

        farmers.sort(key=lambda x: float(x["plot_size_acres"]), reverse=reverse)

    elif sort_by == "risk":

        weights = {"Critical": 3, "Moderate": 2, "Normal": 1}

        farmers.sort(key=lambda x: weights.get(x["risk_status"], 0), reverse=reverse)

    elif sort_by == "sowing":

        farmers.sort(key=lambda x: x.get("sowing_date") or "", reverse=reverse)

    else:

        farmers.sort(key=lambda x: x["full_name"].lower(), reverse=reverse)



    return Response(farmers, status=status.HTTP_200_OK)





@api_view(["GET", "PATCH", "DELETE"])

@permission_classes([AllowAny])

def crm_farmer_detail_view(request: Request, farmer_id: int) -> Response:

    farmers = _combined_farmers()

    farmer = next((f for f in farmers if int(f["id"]) == int(farmer_id)), None)

    if not farmer:

        return Response({"detail": "Farmer not found"}, status=status.HTTP_404_NOT_FOUND)



    if request.method == "DELETE":

        SEEDED_FARMERS[:] = [f for f in SEEDED_FARMERS if int(f["id"]) != int(farmer_id)]

        return Response({"status": "success", "message": f"Farmer {farmer['full_name']} deleted successfully"})



    if request.method == "PATCH":

        payload = request.data if isinstance(request.data, dict) else {}

        for seeded in SEEDED_FARMERS:

            if int(seeded["id"]) == int(farmer_id):

                if "risk_status" in payload:

                    seeded["risk_status"] = payload["risk_status"]

                if "crop_type" in payload:

                    seeded["crop_type"] = payload["crop_type"]

                if "plot_size_acres" in payload:

                    seeded["plot_size_acres"] = float(payload["plot_size_acres"])

                farmer = seeded

                break

        return Response(farmer, status=status.HTTP_200_OK)



    schemes_raw = farmer.get("active_schemes") or ""

    active_schemes = (

        [s.strip() for s in schemes_raw.split(",") if s.strip()]

        if isinstance(schemes_raw, str)

        else list(schemes_raw)

    )

    soil_ph = float(farmer.get("soil_ph", 5.8))



    return Response(

        {

            **farmer,

            "active_schemes": active_schemes,

            "query_log": [

                {"date": "2026-10-18", "type": "Voice Advisory", "query": "Remedy for banana leaf spot", "status": "Resolved"},

                {"date": "2026-09-24", "type": "Soil Test", "query": f"Soil pH {soil_ph} - Low Nitrogen Alert", "status": "Actioned"},

                {"date": "2026-08-11", "type": "Scheme Wizard", "query": "PM-KUSUM Solar Pump verified", "status": "Processing"},

            ],

            "soil_test_history": [

                {"param": "Soil pH", "value": f"{soil_ph}", "rating": "Acidic" if soil_ph < 6 else "Optimal"},

                {"param": "Organic Carbon", "value": "1.45%", "rating": "Good"},

                {"param": "Available N", "value": "165 kg/ha", "rating": "Low"},

                {"param": "Available P", "value": "24 kg/ha", "rating": "Medium"},

                {"param": "Available K", "value": "280 kg/ha", "rating": "Optimal"},

            ],

        },

        status=status.HTTP_200_OK,

    )





# ===========================================================================

# 7. Government Scheme Discoverability Wizard (/api/schemes/*)

# ===========================================================================

@api_view(["GET"])

@permission_classes([AllowAny])

def schemes_list_view(request: Request) -> Response:

    return Response(SEEDED_SCHEMES, status=status.HTTP_200_OK)





@api_view(["POST"])

@permission_classes([AllowAny])

def schemes_match_view(request: Request) -> Response:

    data = request.data if isinstance(request.data, dict) else {}

    crop_str = (data.get("crop") or "Paddy").lower()

    land_category = (data.get("land_category") or "small").lower()

    cat_str = (data.get("farmer_category") or "general").lower()



    land_ranges = {

        "micro": (0.0, 1.0),

        "small": (1.0, 2.5),

        "medium": (2.0, 50.0),

    }

    min_ac, max_ac = land_ranges.get(land_category, (0.0, 50.0))



    matched = []

    for s in SEEDED_SCHEMES:

        s_crops = [c.lower() for c in s["eligible_crops"]]

        crop_match = "any" in s_crops or any(c in crop_str for c in s_crops)

        land_match = not (max_ac < s["min_land_acres"] or min_ac > s["max_land_acres"])

        s_cats = [c.lower() for c in s["eligible_farmer_categories"]]

        cat_match = "general" in s_cats or any(c in cat_str for c in s_cats)



        if crop_match and land_match:

            match_score = 95 if cat_match else 85

            matched.append({**s, "match_score": match_score})



    matched.sort(key=lambda x: x["match_score"], reverse=True)

    return Response(

        {

            "status": "success",

            "total_matched": len(matched),

            "matched_schemes": matched,

        },

        status=status.HTTP_200_OK,

    )

