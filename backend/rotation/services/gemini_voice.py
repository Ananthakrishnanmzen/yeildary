from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional, Tuple

from django.conf import settings
from google import genai
from google.genai import types
from google.genai.errors import APIError, ServerError
from pydantic import BaseModel, Field

from rotation.services.gemini_advisor import FALLBACK_MODELS

logger = logging.getLogger(__name__)


class VoiceConversationResponseSchema(BaseModel):
    user_transcript: str = Field(
        description="The transcribed or normalized user inquiry in the original spoken language"
    )
    detected_intent: str = Field(
        description="Short agricultural category, e.g., 'Farm Land Diagnostics', 'Crop Improvement Strategy', 'Farm Land & Crop Records', 'Pest & Disease Advisory', 'Soil Acidity & Nutrients', 'PM-KUSUM Subsidy', 'Crop Rotation Advice', 'Weather & Irrigation'"
    )
    answer_text: str = Field(
        description="Conversational, accurate, and practical answer strictly in the requested language for speech synthesis and text display"
    )
    translated_en: str = Field(
        description="English translation or summary of the answer for admin logs and preview"
    )


def handle_gemini_voice_conversation(
    query_text: str = "",
    language: str = "ml",
    conversation_history: Optional[List[Dict[str, Any]]] = None,
    audio_bytes: Optional[bytes] = None,
    audio_mime_type: str = "audio/webm",
    kb_context: Optional[Dict[str, Any]] = None,
    farmer_context: Optional[Dict[str, Any]] = None,
) -> Tuple[Dict[str, Any], bool, str]:
    """Process a voice or text conversational query using AI with automatic model fallback.

    When `farmer_context` is provided:
        - Answers direct questions about farmer identity, registered crops, acreage, location.
        - Answers indirect diagnostic questions (e.g. 'what is the problem on my land?') using real database telemetry, soil, and active alerts.
        - Answers indirect improvement questions (e.g. 'how can I improve my crop growing?') using database crop rotation plans and soil impact data.
    When `kb_context` is provided: answers questions related to the KB with the help of the selected KB.
    When `kb_context` is None: answers questions directly from its own agricultural knowledge without KB.

    Returns:
        (result_dict, used_fallback_bool, model_used_str)
    """
    lang_code = (language or "ml").lower()
    lang_map = {
        "ml": "Malayalam (മലയാളം)",
        "hi": "Hindi (हिन्दी)",
        "en": "English",
        "ta": "Tamil (தமிழ்)",
        "te": "Telugu (తెలుగు)",
        "kn": "Kannada (ಕನ್ನಡ)",
    }
    lang_display = lang_map.get(lang_code, "Malayalam (മലയാളം)")

    api_key = (
        getattr(settings, "GEMINI_API_KEY", None)
        or os.environ.get("GEMINI_API_KEY", "").strip()
        or os.environ.get("GOOGLE_API_KEY", "").strip()
        or os.environ.get("VITE_GEMINI_API_KEY", "").strip()
    )

    if not api_key:
        logger.warning("AI voice assistant API key is not configured; falling back to local KB.")
        return {}, True, "fallback"

    system_instruction = (
        "You are the Yieldary AI Multilingual Farmer Voice Helpdesk — an empathetic, expert, and practical agricultural AI assistant. "
        "You assist farmers with real-time agronomic guidance, crop disease diagnostics, pest control, soil fertility, "
        "irrigation scheduling, weather adaptation, organic practices, and Indian government agriculture schemes (e.g., PM-KUSUM, PMFBY, PKVY, PM-KISAN, Rythu Bharosa). "
        f"CRITICAL REQUIREMENT: You MUST answer and communicate strictly in {lang_display}. "
        "Keep your answers concise, practical, and conversational so they sound natural and clear when spoken aloud via Text-to-Speech (TTS). "
        "Provide actionable step-by-step instructions (e.g. dosages in ml/L or kg/acre, application intervals, safe handling). "
        "Maintain context from prior messages in the conversation history if present. "
        "CRITICAL BRANDING RULE: Never mention or identify yourself as 'Gemini', Google, or any AI model brand. You are solely the Yieldary Agricultural Voice Assistant. "
        "Always format your response to conform with the VoiceConversationResponseSchema JSON structure."
    )

    # Inject real farmer records retrieved from database
    if farmer_context:
        farmer_json = json.dumps(farmer_context, ensure_ascii=False, indent=2)
        system_instruction += (
            f"\n\n[FARMER PROFILE, TELEMETRY, SOIL & ROTATION DATA FROM DATABASE]\n"
            f"The inquiring farmer's real-time farm records, satellite telemetry, land problems, and crop improvement diagnostics from the database are:\n"
            f"{farmer_json}\n\n"
            f"CRITICAL OPERATING INSTRUCTION FOR DIRECT & INDIRECT FARM INQUIRIES:\n"
            f"1. DIRECT INQUIRIES (e.g., 'What crops do I grow?', 'How much land do I have?', 'Where is my farm?'):\n"
            f"   - Directly state registered crops ({farmer_context.get('crops_grown')}), land acreage ({farmer_context.get('farm_area_acres')} acres), and location ({farmer_context.get('location')}).\n"
            f"2. INDIRECT INQUIRIES ABOUT LAND PROBLEMS (e.g., 'What is the problem on my land?', 'Is my soil damaged?', 'Why is my yield dropping?', 'Any risks or issues on my field?'):\n"
            f"   - You MUST diagnose their field using the fetched database records above: analyze the active telemetry alerts, water stress index, slope degrees, erosion risk score, and continuous cropping vulnerabilities for their crops ({farmer_context.get('crops_grown')}).\n"
            f"   - Give an empathetic, clear diagnostic breakdown in {lang_display} explaining what challenges were detected on their land.\n"
            f"3. INDIRECT INQUIRIES ABOUT CROP IMPROVEMENT (e.g., 'How can I improve my crop growing?', 'How to increase yield?', 'How to boost soil health?', 'What should I plant next?'):\n"
            f"   - You MUST recommend actionable, tailored agronomic improvement steps using their database rotation plans ({farmer_context.get('rotation_strategy')}): such as rotating with nitrogen-fixing green gram or sunn hemp cover crops to increase soil health by 40%, organic contour mulching for slope erosion, and water-saving irrigation.\n"
            f"   - Keep advice conversational, highly encouraging, practical, and clear in {lang_display}.\n"
            f"4. Never contradict or ignore these verified database farm records."
        )

    if kb_context:
        intent_info = kb_context.get("intent", "Agricultural Advisory")
        ref_text = (
            kb_context.get(f"answer_{lang_code}")
            or kb_context.get("answer_en")
            or ""
        )
        sample_q = (
            kb_context.get(f"sample_transcript_{lang_code}")
            or kb_context.get("sample_transcript_en")
            or ""
        )
        system_instruction += (
            f"\n\n[SELECTED VERIFIED KNOWLEDGE BASE CONTEXT]\n"
            f"The user inquiry directly matches a verified entry in our regional Agricultural Knowledge Base.\n"
            f"- Topic/Intent: {intent_info}\n"
            f"- Verified Reference Advice & Dosages: {ref_text}\n"
            f"- Associated Reference Query: {sample_q}\n\n"
            f"OPERATING INSTRUCTION: Answer this question with the help of your agricultural intelligence AND the selected verified knowledge base provided above. "
            f"Incorporate the verified dosages, scientific fungicides/bio-fertilizers, and government guidelines from the knowledge base, "
            f"while formulating a warm, helpful, and natural spoken response in {lang_display}. "
            f"Ensure detected_intent reflects '{intent_info}'."
        )
    else:
        system_instruction += (
            f"\n\n[DIRECT AUTONOMOUS AGRICULTURAL KNOWLEDGE MODE - OUTSIDE KB]\n"
            f"The user's question is NOT in the pre-stored regional knowledge base.\n"
            f"OPERATING INSTRUCTION: You MUST answer this question directly, fully, and comprehensively from your own vast agricultural, crop science, plant pathology, entomology, soil chemistry, climate adaptation, irrigation, and agronomic knowledge in {lang_display}.\n"
            f"Do not give generic disclaimers or say you do not know. Provide clear, practical, expert recommendations including specific crop treatments, organic solutions, watering practices, or nutrient schedules suitable for Indian agriculture in {lang_display}."
        )

    configured_model = getattr(settings, "GEMINI_MODEL", "") or os.environ.get("GEMINI_MODEL", "").strip()
    models_to_try: List[str] = []
    for candidate in [configured_model, *FALLBACK_MODELS]:
        if candidate and candidate not in models_to_try:
            models_to_try.append(candidate)

    try:
        client = genai.Client(
            api_key=api_key,
            http_options=types.HttpOptions(timeout=20000),
        )
    except Exception as exc:
        logger.warning("Failed to initialize AI client for voice helpdesk (%s); using fallback.", exc)
        return {}, True, "fallback"

    contents_list: List[types.Content] = []

    # Map conversation history
    for msg in (conversation_history or []):
        if not isinstance(msg, dict):
            continue
        role_raw = msg.get("sender") or msg.get("role") or ""
        role = "model" if role_raw in ["bot", "model", "assistant"] else "user"
        text = (msg.get("text") or msg.get("content") or "").strip()
        if text and not msg.get("isTyping"):
            contents_list.append(types.Content(role=role, parts=[types.Part.from_text(text=text)]))

    # Add the current user query or audio
    user_parts: List[types.Part] = []
    if audio_bytes:
        user_parts.append(types.Part.from_bytes(data=audio_bytes, mime_type=audio_mime_type))
        if query_text:
            user_parts.append(types.Part.from_text(text=query_text))
        else:
            user_parts.append(types.Part.from_text(
                text=f"Listen to the farmer audio inquiry carefully. Transcribe the query into user_transcript, detect the intent, and provide an empathetic, actionable answer in {lang_display} in answer_text, with an English summary in translated_en."
            ))
    elif query_text:
        user_parts.append(types.Part.from_text(text=query_text))

    if not user_parts:
        return {}, True, "fallback"

    contents_list.append(types.Content(role="user", parts=user_parts))

    for model_name in models_to_try:
        try:
            response = client.models.generate_content(
                model=model_name,
                contents=contents_list,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    response_mime_type="application/json",
                    response_schema=VoiceConversationResponseSchema,
                    temperature=0.3,
                    http_options=types.HttpOptions(timeout=20000),
                ),
            )
            parsed = json.loads(response.text)
            parsed["kb_grounded"] = bool(kb_context)
            parsed["kb_intent"] = kb_context.get("intent") if kb_context else None
            return parsed, False, "AI Voice Assistant"
        except (APIError, ServerError, ValueError, TypeError, json.JSONDecodeError) as exc:
            logger.warning("AI model %s failed for voice desk (%s); trying fallback.", model_name, exc)
        except Exception as exc:
            logger.warning("Unexpected error on %s for voice desk (%s); trying fallback.", model_name, exc)

    logger.error("All AI models failed for voice desk; falling back.")
    return {}, True, "fallback"
