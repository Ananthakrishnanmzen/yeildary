from __future__ import annotations

import json
import logging
import os
from typing import Literal

from django.conf import settings
from google import genai
from google.genai import types
from google.genai.errors import APIError, ServerError
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

FALLBACK_MODELS = [
    'gemini-2.0-flash',
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
]


class StrategyDetail(BaseModel):
    strategy_name: str
    recommended_crop_sequence: list[str]
    suitability_score: int = Field(ge=0, le=100)
    water_efficiency_score: int = Field(ge=0, le=100)
    soil_health_impact_pct: int = Field(ge=-100, le=100)
    market_viability_score: int = Field(ge=0, le=100)
    market_demand_status: Literal['High', 'Moderate', 'Crashing']
    agronomic_reasoning: str


class AlertItem(BaseModel):
    alert_title: str
    alert_message: str
    severity: Literal['HIGH', 'MEDIUM', 'LOW']


class RotationResponseSchema(BaseModel):
    realtime_alerts: list[AlertItem]
    baseline: StrategyDetail
    resilience_build: StrategyDetail
    water_saver: StrategyDetail


def _clamp_int(value: float, low: int, high: int) -> int:
    return max(low, min(high, int(round(value))))


_TRANSLATIONS = {
    'malayalam': {
        'advisory_title': 'ടെലിമെട്രി മുന്നറിയിപ്പ് ({location})',
        'advisory_msg': (
            'മണ്ണിലെ ഈർപ്പം {smap}, ജലസമ്മർദ്ദ സൂചിക {stress:.1f}, '
            'മണ്ണൊലിപ്പ് സാധ്യത (RUSLE) {erosion:.1f}/100 (ചരിവ് {slope:.1f}°).'
        ),
        'erosion_title': 'മേൽമണ്ണ് സംരക്ഷണം അടിയന്തരമായി ആവശ്യമാണ്',
        'erosion_msg': (
            '{slope:.1f}° ചരിവുള്ള ഭൂമിയിൽ {rain} മഴയും ഉയർന്ന മണ്ണൊലിപ്പ് സാധ്യതയും ({erosion:.1f}/100) കാണുന്നു. '
            'ആവരണ വിളകളും (Cover crops) പുതയിടലും ഉടൻ നടപ്പിലാക്കുക.'
        ),
        'baseline_name': 'നിലവിലെ കൃഷിരീതി (Baseline)',
        'baseline_reason': (
            '{soil} മണ്ണിൽ {smap} ഈർപ്പവും {erosion:.1f}/100 മണ്ണൊലിപ്പ് സാധ്യതയും നിലനിൽക്കെ '
            'തുടർച്ചയായി ഒരേ വിള കൃഷി ചെയ്യുന്നത് മണ്ണിന്റെ ഫലപുഷ്ടി കുറയ്ക്കും.'
        ),
        'resilience_name': 'മണ്ണ് സംരക്ഷണ-ഇടവിള കൃഷിരീതി',
        'resilience_reason': (
            '{slope:.1f}° ചരിവുള്ള {soil} മണ്ണിൽ മണ്ണൊലിപ്പ് തടയാൻ പയറുവർഗ്ഗ ആവരണ വിളകളും '
            'രാമച്ചവും (Vetiver) ചേർത്തുള്ള കൃഷിരീതി മണ്ണിലെ ജൈവാംശം വർദ്ധിപ്പിക്കുന്നു.'
        ),
        'water_name': 'ജലസംരക്ഷണ കൃഷിരീതി (Water-Saver)',
        'water_reason': (
            '{stress:.1f} ജലസമ്മർദ്ദ സൂചികയും {rain} മഴയും കണക്കിലെടുത്ത് '
            'ജലനഷ്ടം കുറയ്ക്കുന്ന പുതയിട്ട ഇഞ്ചി, മഞ്ഞൾ തുടങ്ങിയ വിളകൾ സംയോജിപ്പിക്കുന്നു.'
        ),
    },
    'tamil': {
        'advisory_title': 'செயற்கைக்கோள் கள எச்சரிக்கை ({location})',
        'advisory_msg': (
            'மண் ஈரப்பதம் {smap}, நீர் அழுத்த குறியீடு {stress:.1f}, '
            'RUSLE மண்ணரிப்பு அபாயம் {erosion:.1f}/100 (சாய்வு {slope:.1f}°).'
        ),
        'erosion_title': 'மேல்மண் பாதுகாப்பு உடனடியாக தேவை',
        'erosion_msg': (
            '{slope:.1f}° சாய்விலும் {rain} மழையிலும் மண்ணரிப்பு ({erosion:.1f}/100) அதிகம். '
            'மூடுபயிர்கள் மற்றும் வெட்டிவேர் தடுப்புகளை உடனடியாக அமைக்கவும்.'
        ),
        'baseline_name': 'தற்போதைய பயிர் முறை (Baseline)',
        'baseline_reason': (
            '{soil} மண்ணில் {smap} ஈரப்பதம் மற்றும் {erosion:.1f}/100 மண்ணரிப்பு அபாயத்துடன் '
            '{crops} தொடர்ந்து பயிரிடுவது மண் வளத்தைக் குறைக்கலாம்.'
        ),
        'resilience_name': 'மண் வளம் மற்றும் அரிப்பு தடுப்பு சுழற்சி',
        'resilience_reason': (
            '{slope:.1f}° சாய்வில் {soil} மண்ணை நிலைப்படுத்த {res_crops} '
            'சிறந்த பயிர் சுழற்சியாகும்.'
        ),
        'water_name': 'நீர் சேமிப்பு பயிர் சுழற்சி (Water-Saver)',
        'water_reason': (
            '{stress:.1f} நீர் அழுத்த நிலையிலும் {rain} மழையிலும் ஈரப்பதத்தைத் தக்கவைக்க '
            '{wat_crops} உதவுகிறது.'
        ),
    },
    'hindi': {
        'advisory_title': 'टेलीमेट्री चेतावनी ({location})',
        'advisory_msg': (
            'मिट्टी की नमी {smap}, जल तनाव सूचकांक {stress:.1f}, '
            'और RUSLE मृदा अपरदन जोखिम {erosion:.1f}/100 (ढलान {slope:.1f}°)।'
        ),
        'erosion_title': 'ऊपरी मिट्टी संरक्षण तुरंत आवश्यक है',
        'erosion_msg': (
            '{slope:.1f}° ढलान और {rain} वर्षा पर अपरदन जोखिम ({erosion:.1f}/100) अधिक है। '
            'आवरण फसलें (Cover crops) और मल्चिंग तुरंत लागू करें।'
        ),
        'baseline_name': 'वर्तमान फसल प्रणाली (Baseline)',
        'baseline_reason': (
            '{soil} मिट्टी में {smap} नमी और {erosion:.1f}/100 अपरदन जोखिम के साथ '
            '{crops} की निरंतर खेती मिट्टी की उर्वरता कम कर सकती है।'
        ),
        'resilience_name': 'मृदा संरक्षण एवं अंतर-फसल चक्र',
        'resilience_reason': (
            '{slope:.1f}° ढलान वाली {soil} मिट्टी को स्थिर करने और जैविक कार्बन बढ़ाने के लिए '
            '{res_crops} उपयुक्त हैं।'
        ),
        'water_name': 'जल-बचत फसल चक्र (Water-Saver)',
        'water_reason': (
            '{stress:.1f} जल तनाव और {rain} वर्षा के बीच नमी बनाए रखने के लिए '
            '{wat_crops} प्रभावी हैं।'
        ),
    },
    'english': {
        'advisory_title': 'Telemetry Advisory ({location})',
        'advisory_msg': (
            'Soil moisture is {smap}, Water Stress Index is {stress:.1f}, '
            'and RUSLE Erosion Risk is {erosion:.1f}/100 (slope {slope:.1f}°).'
        ),
        'erosion_title': 'Topsoil Erosion Mitigation Required',
        'erosion_msg': (
            'High RUSLE score ({erosion:.1f}/100) on {slope:.1f}° slope and {rain} rainfall. '
            'Prioritize contour vegetative barriers, mulching, and legume cover cropping.'
        ),
        'baseline_name': 'Baseline Continuation',
        'baseline_reason': (
            'Evaluates continuing {crops} on {soil} under {smap} soil moisture '
            'and {erosion:.1f}/100 RUSLE erosion risk.'
        ),
        'resilience_name': 'Soil Resilience & Cover Rotation',
        'resilience_reason': (
            'Pairs {res_crops} to stabilize {soil} on a {slope:.1f}° slope, '
            'boost organic matter, and reduce topsoil runoff.'
        ),
        'water_name': 'Low-ET Water-Saver Rotation',
        'water_reason': (
            'Combines {wat_crops} to optimize water-use efficiency under '
            '{stress:.1f} Water Stress Index and {rain} precipitation.'
        ),
    },
}


_CROP_TRANSLATIONS = {
    'malayalam': {
        'Black Pepper': 'കുരുമുളക് (Black Pepper)',
        'Cardamom': 'ഏലം (Cardamom)',
        'Cowpea (Legume Cover)': 'വൻപയർ ആവരണ വിള (Cowpea)',
        'Vetiver Grass (Slope Stabilizer)': 'രാമച്ചം (Vetiver Grass)',
        'Ginger (Mulched)': 'പുതയിട്ട ഇഞ്ചി (Ginger)',
        'Turmeric': 'മഞ്ഞൾ (Turmeric)',
        'Dwarf Banana': 'കുള്ളൻ വാഴ (Dwarf Banana)',
        'Rice (Paddy)': 'നെല്ല് (Rice)',
        'Maize': 'ചോളം (Maize)',
        'Green Gram (Moong)': 'ചെറുപയർ (Green Gram)',
        'Sunn Hemp Cover': 'ചണമ്പ് (Sunn Hemp)',
        'Pearl Millet (Bajra)': 'കമ്പം (Pearl Millet)',
        'Chickpea': 'കടല (Chickpea)',
        'Sesame': 'എള്ള് (Sesame)',
    },
    'tamil': {
        'Black Pepper': 'மிளகு (Black Pepper)',
        'Cardamom': 'ஏலக்காய் (Cardamom)',
        'Cowpea (Legume Cover)': 'தட்டைப்பயறு (Cowpea)',
        'Vetiver Grass (Slope Stabilizer)': 'வெட்டிவேர் (Vetiver)',
        'Ginger (Mulched)': 'இஞ்சி (Ginger)',
        'Turmeric': 'மஞ்சள் (Turmeric)',
        'Dwarf Banana': 'குள்ள வாழை (Dwarf Banana)',
        'Rice (Paddy)': 'நெல் (Rice)',
        'Maize': 'மக்காச்சோளம் (Maize)',
        'Green Gram (Moong)': 'பாசிப்பயறு (Green Gram)',
        'Sunn Hemp Cover': 'சணப்பை (Sunn Hemp)',
        'Pearl Millet (Bajra)': 'கம்பு (Pearl Millet)',
        'Chickpea': 'கொண்டைக்கடலை (Chickpea)',
        'Sesame': 'எள் (Sesame)',
    },
    'hindi': {
        'Black Pepper': 'काली मिर्च (Black Pepper)',
        'Cardamom': 'इलायची (Cardamom)',
        'Cowpea (Legume Cover)': 'लोबिया (Cowpea)',
        'Vetiver Grass (Slope Stabilizer)': 'खस घास (Vetiver)',
        'Ginger (Mulched)': 'अदरक (Ginger)',
        'Turmeric': 'हल्दी (Turmeric)',
        'Dwarf Banana': 'बौना केला (Dwarf Banana)',
        'Rice (Paddy)': 'धान (Rice)',
        'Maize': 'मक्का (Maize)',
        'Green Gram (Moong)': 'मूंग (Green Gram)',
        'Sunn Hemp Cover': 'सनई (Sunn Hemp)',
        'Pearl Millet (Bajra)': 'बाजरा (Pearl Millet)',
        'Chickpea': 'चना (Chickpea)',
        'Sesame': 'तिल (Sesame)',
    },
}


def _select_agro_crops(
    baseline_crops: list[str],
    rain_val: float | None,
    slope_val: float,
    lang_key: str,
) -> tuple[list[str], list[str], list[str]]:
    is_humid_sloped = (rain_val is not None and rain_val > 150.0) or slope_val > 12.0

    if is_humid_sloped:
        base_seq = baseline_crops[:3] if baseline_crops else ['Black Pepper', 'Cardamom']
        res_seq = ['Black Pepper', 'Cowpea (Legume Cover)', 'Vetiver Grass (Slope Stabilizer)']
        wat_seq = ['Ginger (Mulched)', 'Turmeric', 'Dwarf Banana']
    else:
        base_seq = baseline_crops[:3] if baseline_crops else ['Rice (Paddy)', 'Maize']
        res_seq = ['Green Gram (Moong)', 'Sunn Hemp Cover', 'Maize']
        wat_seq = ['Pearl Millet (Bajra)', 'Chickpea', 'Sesame']

    cmap = _CROP_TRANSLATIONS.get(lang_key)
    if cmap:
        base_seq = [cmap.get(c, c) for c in base_seq]
        res_seq = [cmap.get(c, c) for c in res_seq]
        wat_seq = [cmap.get(c, c) for c in wat_seq]

    return base_seq, res_seq, wat_seq


def _fallback_decision_matrix(payload: dict) -> dict:
    """Return a telemetry-grounded, localized fallback matrix when Gemini models are unavailable."""

    farmer = payload.get('farmer_context') or {}
    telemetry = payload.get('realtime_telemetry_alerts') or {}
    market = payload.get('market_context') or {}

    location = farmer.get('location_name') or 'Registered Farm'
    lang = str(farmer.get('preferred_language') or 'English').strip()
    lang_key = lang.lower()
    if lang_key not in _TRANSLATIONS:
        lang_key = 'english'
    t = _TRANSLATIONS[lang_key]

    baseline_crops = [str(c).strip() for c in (farmer.get('baseline_crops') or []) if str(c).strip()]

    weights = farmer.get('constraint_weights') or {}
    water_w = float(weights.get('water_availability', 50))
    budget_w = float(weights.get('budget', 50))
    market_w = float(weights.get('market_demand', 50))

    smap = telemetry.get('current_smap_moisture')
    rain = telemetry.get('recent_gpm_rainfall_mm')
    stress = telemetry.get('water_stress_index')
    erosion = telemetry.get('rusle_erosion_risk_score')
    slope = telemetry.get('slope_degrees')
    soil_texture = telemetry.get('soil_texture_class') or 'local soil'

    rain_val = float(rain) if rain is not None else None
    stress_val = float(stress) if stress is not None else 35.0
    erosion_val = float(erosion) if erosion is not None else 30.0
    slope_val = float(slope) if slope is not None else 4.0
    smap_str = f'{float(smap):.3f} m³/m³' if smap is not None else 'N/A'
    rain_str = f'{rain_val:.1f} mm/mo' if rain_val is not None else 'N/A'

    base_seq, res_seq, wat_seq = _select_agro_crops(baseline_crops, rain_val, slope_val, lang_key)

    market_status = market.get('overall_demand_status') or 'Moderate'
    if market_status not in ('High', 'Moderate', 'Crashing'):
        market_status = 'Moderate'

    ctx = {
        'location': location,
        'smap': smap_str,
        'stress': stress_val,
        'erosion': erosion_val,
        'slope': slope_val,
        'rain': rain_str,
        'soil': soil_texture,
        'crops': ', '.join(base_seq),
        'res_crops': ' + '.join(res_seq),
        'wat_crops': ' + '.join(wat_seq),
    }

    alerts = [
        {
            'alert_title': t['advisory_title'].format(**ctx),
            'alert_message': t['advisory_msg'].format(**ctx),
            'severity': 'HIGH' if (erosion_val >= 65 or stress_val >= 65) else 'MEDIUM',
        }
    ]
    if erosion_val >= 60:
        alerts.append(
            {
                'alert_title': t['erosion_title'].format(**ctx),
                'alert_message': t['erosion_msg'].format(**ctx),
                'severity': 'HIGH',
            }
        )

    baseline_suitability = _clamp_int(78 - erosion_val * 0.28 - stress_val * 0.18, 25, 92)
    resilience_suitability = _clamp_int(76 + (budget_w - 50) * 0.12 - erosion_val * 0.08, 45, 96)
    water_suitability = _clamp_int(74 + (100 - water_w) * 0.15 - stress_val * 0.05, 45, 95)

    return {
        'realtime_alerts': alerts,
        'baseline': {
            'strategy_name': t['baseline_name'],
            'recommended_crop_sequence': base_seq,
            'suitability_score': baseline_suitability,
            'water_efficiency_score': _clamp_int(72 - stress_val * 0.4, 20, 90),
            'soil_health_impact_pct': _clamp_int(10 - erosion_val * 0.35, -60, 40),
            'market_viability_score': _clamp_int(55 + market_w * 0.25, 30, 95),
            'market_demand_status': market_status,
            'agronomic_reasoning': t['baseline_reason'].format(**ctx),
        },
        'resilience_build': {
            'strategy_name': t['resilience_name'],
            'recommended_crop_sequence': res_seq,
            'suitability_score': resilience_suitability,
            'water_efficiency_score': _clamp_int(74 + (100 - stress_val) * 0.12, 40, 95),
            'soil_health_impact_pct': _clamp_int(32 + min(25, erosion_val * 0.25), 10, 85),
            'market_viability_score': _clamp_int(62 + market_w * 0.24, 35, 95),
            'market_demand_status': 'High' if market_w >= 65 else 'Moderate',
            'agronomic_reasoning': t['resilience_reason'].format(**ctx),
        },
        'water_saver': {
            'strategy_name': t['water_name'],
            'recommended_crop_sequence': wat_seq,
            'suitability_score': water_suitability,
            'water_efficiency_score': _clamp_int(84 + (100 - water_w) * 0.1, 55, 98),
            'soil_health_impact_pct': 22,
            'market_viability_score': _clamp_int(58 + market_w * 0.25, 35, 94),
            'market_demand_status': 'Moderate',
            'agronomic_reasoning': t['water_reason'].format(**ctx),
        },
    }


def generate_rotation_strategies(payload: dict) -> tuple[dict, bool, str]:
    """Call Gemini with model fallback; never raise on model/key failure."""

    api_key = getattr(settings, 'GEMINI_API_KEY', None) or os.environ.get('GEMINI_API_KEY', '').strip()
    if not api_key:
        logger.warning('GEMINI_API_KEY is not configured; returning fallback rotation matrix.')
        return _fallback_decision_matrix(payload), True, 'fallback'

    preferred_lang = (
        payload.get('farmer_context', {}).get('preferred_language') or 'English'
    )
    system_instruction = (
        'You are an autonomous Precision Agriculture Systems Intelligence Engine analyzing NASA Earth Observation data. '
        'Infer the agro-climatic zone strictly from farmer_context.coordinates and the provided telemetry values. '
        'Evaluate farmer_context.baseline_crops and select regionally, climatically, and pedologically appropriate '
        'rotation crops for that exact global coordinate—never output generic placeholders like "Regional Staple". '
        f'CRITICAL: Write all human-readable values (alert_title, alert_message, strategy_name, agronomic_reasoning) fluently in {preferred_lang}. '
        "Keep JSON keys and market_demand_status ('High', 'Moderate', 'Crashing') and severity ('HIGH', 'MEDIUM', 'LOW') in English."
    )

    configured_model = os.environ.get('GEMINI_MODEL', '').strip()
    models_to_try: list[str] = []
    for candidate in [configured_model, *FALLBACK_MODELS]:
        if candidate and candidate not in models_to_try:
            models_to_try.append(candidate)

    try:
        client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(timeout=12000),
        )
    except Exception as exc:
        logger.warning('Failed to initialize Gemini client (%s); returning fallback rotation matrix.', exc)
        return _fallback_decision_matrix(payload), True, 'fallback'
    contents = json.dumps(payload)

    for model_name in models_to_try:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=contents,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type='application/json',
                    response_schema=RotationResponseSchema,
                    temperature=0.2,
                    http_options=types.HttpOptions(timeout=12000),
                ),
            )
            parsed = json.loads(response.text)
            return parsed, False, model_name
        except (APIError, ServerError, ValueError, TypeError, json.JSONDecodeError) as exc:
            logger.warning('Gemini model %s failed (%s); trying next fallback.', model_name, exc)
        except Exception as exc:
            logger.warning('Unexpected Gemini error on %s (%s); trying next fallback.', model_name, exc)

    logger.error('All Gemini models failed; returning fallback rotation matrix.')
    return _fallback_decision_matrix(payload), True, 'fallback'
