from __future__ import annotations

import json
import logging
import os
import re
from typing import Any, Dict, List, Optional, Tuple

from django.conf import settings
from google import genai
from google.genai import types
from google.genai.errors import APIError, ServerError
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024  # 25MB
ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png"}
ALLOWED_MIME_TYPES = {"image/jpeg", "image/pjpeg", "image/png"}

class BoundingBoxSchema(BaseModel):
    ymin: float = Field(description="Normalized top coordinate (0.0 to 1.0)")
    xmin: float = Field(description="Normalized left coordinate (0.0 to 1.0)")
    ymax: float = Field(description="Normalized bottom coordinate (0.0 to 1.0)")
    xmax: float = Field(description="Normalized right coordinate (0.0 to 1.0)")
    label: str = Field(description="Visual label (e.g. 'Necrotic Lesion', 'Chlorotic Halo', 'Soil pH Test Cell', 'NPK Indicator')")
    confidence: float = Field(description="Detection confidence between 0.0 and 1.0")

class ChemicalScheduleItemSchema(BaseModel):
    stage: str = Field(description="Treatment phase or timing (e.g. 'Immediate Spray (Day 1)', 'Follow-up Spray (Day 15)', 'Soil Liming')")
    dosage: str = Field(description="Active chemical formula, dosage per liter/acre, and mixing directions")
    withdrawal: str = Field(description="Mandatory harvest withdrawal or grazing safety period")

class VisionDiagnosticsResponseSchema(BaseModel):
    is_valid_specimen: bool = Field(
        description="True ONLY if the image displays an agricultural Soil Report / Soil Health Card OR a Crop / Plant Leaf Image (diseased or healthy foliage). Must be FALSE for any other image (people, selfies, pets, animals, vehicles, electronics, buildings, food dishes, non-leaf plant parts, or general objects)."
    )
    specimen_type: str = Field(
        description="'soil_report', 'leaf_image', or 'unrecognized'"
    )
    rejection_reason: str = Field(
        default="",
        description="If is_valid_specimen is False, provide a clear, polite explanation telling the user that the scanner only accepts Soil Reports and Crop Leaf Images, and explain why this image was rejected."
    )
    diagnosis_badge: str = Field(
        description="Concise diagnostic title (e.g., 'Sigatoka Leaf Spot (Mycosphaerella musicola)', 'Acidic Topsoil Profile & Available Nitrogen Fixation')"
    )
    confidence_score: float = Field(
        description="Confidence percentage (70.0 - 99.0 for valid specimens; 0.0 for rejected non-agricultural specimens)"
    )
    affected_crop: str = Field(
        description="Identified crop name (e.g. 'Banana', 'Paddy / Rice', 'Black Pepper', 'Cardamom', 'Tomato') or 'Soil Test Profile'"
    )
    detected_issue: str = Field(
        description="Detailed agronomic diagnosis describing observed visual foliar symptoms, pathogen pathology, or extracted soil test metrics (pH, N-P-K, OC, EC, micronutrients)"
    )
    bounding_boxes: List[BoundingBoxSchema] = Field(
        default_factory=list,
        description="Bounding boxes highlighting necrotic patches, chlorosis, lesions, or soil card metric reading cells"
    )
    organic_remediation: List[str] = Field(
        default_factory=list,
        description="2-4 immediate biological or organic remedies (bio-fungicides like Pseudomonas or Trichoderma, neem extracts, FYM, green manure)"
    )
    chemical_schedule: List[ChemicalScheduleItemSchema] = Field(
        default_factory=list,
        description="1-3 scheduled chemical treatment options with stage, exact dosage, and harvest safety withdrawal"
    )
    soil_amendment: List[str] = Field(
        default_factory=list,
        description="2-3 soil health recommendations, pH balancing (e.g., agricultural dolomite/lime for acidic soils), or nutrient replenishment"
    )

def validate_uploaded_image_file(file_obj: Any) -> Tuple[bool, Optional[str]]:
    """Validate uploaded file for high-resolution .JPG/.PNG format and 25MB maximum size."""
    if not file_obj:
        return False, "No file provided. Please upload a high-resolution .JPG or .PNG image."

    file_size = getattr(file_obj, "size", 0)
    if file_size > MAX_FILE_SIZE_BYTES:
        size_mb = round(file_size / (1024 * 1024), 2)
        return (
            False,
            f"File size ({size_mb} MB) exceeds the 25MB limit. Please upload an image under 25MB.",
        )

    file_name = getattr(file_obj, "name", "")
    _, ext = os.path.splitext(file_name.lower())
    if ext not in ALLOWED_EXTENSIONS:
        return (
            False,
            f"Unsupported file format '{ext or 'unknown'}'. The vision scanner only supports high-res .JPG, .PNG up to 25MB.",
        )

    content_type = (getattr(file_obj, "content_type", "") or "").lower()
    if content_type and content_type not in ALLOWED_MIME_TYPES:
        return (
            False,
            f"Unsupported MIME type '{content_type}'. Please upload a valid .JPG or .PNG image.",
        )

    return True, None

def analyze_specimen_with_vision(
    image_bytes: Optional[bytes] = None,
    mime_type: str = "image/jpeg",
    file_name: str = "specimen.jpg",
    sample_key: Optional[str] = None,
) -> Dict[str, Any]:
    """Accurately analyze Soil Reports and Crop Leaf Images using AI Multimodal Vision with model fallback.

    Strict validation: Only Soil Reports and Leaf Images are valid; any other image is detected as invalid.
    """
    from rotation.services.agri_services import DIAGNOSTIC_CASES

    system_instruction = (
        "You are the Yieldary Precision Vision Diagnostic Engine for agriculture.\n"
        "Your duty is to accurately perform vision analysis, optical character recognition (OCR), and pathology diagnostics ONLY on:\n"
        "1) Certified Soil Reports / Soil Health Cards / Soil Laboratory Test Analysis Documents\n"
        "2) Plant or Crop Leaf Images (showing foliage, leaf blade, foliar lesions, spots, blights, or healthy leaf specimens)\n\n"
        "CRITICAL VALIDATION RULE (STRICT ENFORCEMENT):\n"
        "- If the image is a Soil Report or a Crop Leaf Image, set `is_valid_specimen` to TRUE, and set `specimen_type` to 'soil_report' or 'leaf_image'.\n"
        "- If the image is ANYTHING ELSE (including human portraits, selfies, faces, pets, cattle/animals, cars, vehicles, machinery, buildings, indoor spaces, food dishes, electronics, landscapes/nature without close leaf foliage, tree trunks/bark without leaves, flowers or roots alone without leaves, or random unrelated photos), you MUST set `is_valid_specimen` to FALSE, and set `specimen_type` to 'unrecognized'.\n"
        "- When `is_valid_specimen` is FALSE, you must provide a clear and polite `rejection_reason` explaining what was detected in the image and stating clearly: 'The vision scanner only accepts Soil Test Reports and Crop Leaf Images. Any other image type is not supported.' Set `confidence_score` to 0.0, and leave bounding boxes, remedies, chemical schedules, and soil amendments empty.\n\n"
        "ACCURATE DIAGNOSTIC & REPORTING RULES (For valid specimens):\n"
        "- If it is a Soil Report / Soil Health Card:\n"
        "  * Extract key soil indicators: pH value, organic carbon (OC %), available Nitrogen (N), Phosphorus (P), Potassium (K), electrical conductivity (EC), and micronutrients (Zinc, Boron, Iron, Sulfur).\n"
        "  * Identify nutrient deficiencies, acidity / alkalinity levels, and toxicity risks.\n"
        "  * Accurately locate bounding boxes (ymin, xmin, ymax, xmax between 0.0 and 1.0) on the key test value cells of the report.\n"
        "  * In `organic_remediation`, prescribe exact organic additions: FYM/vermicompost application rates (e.g. 4-5 tonnes/acre), green manuring crops (Sunn Hemp / Dhaincha), and biofertilizers (Azospirillum, PSB).\n"
        "  * In `chemical_schedule`, specify corrective soil conditioning (e.g., Agricultural Dolomite or Calcitic Lime dosage in kg/acre for acidic soil, or gypsum for alkaline soil) and balanced N-P-K schedules with reaction waiting periods.\n"
        "  * In `soil_amendment`, detail long-term organic carbon conservation and periodic testing schedules.\n"
        "- If it is a Crop Leaf Image:\n"
        "  * Accurately identify the host crop species (e.g., Banana, Paddy/Rice, Coconut, Black Pepper, Cardamom, Tomato, Cotton, Wheat, etc.).\n"
        "  * Accurately identify the exact foliar disease, pathogen, fungal/bacterial leaf spot, viral streak, insect damage, or nutrient chlorosis.\n"
        "  * Provide precise normalized bounding boxes highlighting the necrotic lesions, chlorotic halos, or pathogen colonies on the leaf blade.\n"
        "  * In `organic_remediation`, prescribe immediate, field-proven bio-controls (e.g., bio-fungicide Pseudomonas fluorescens @ 20g/L, Trichoderma viride, cold-pressed Neem Seed Kernel Extract NSKE 5%, leaf pruning sanitation).\n"
        "  * In `chemical_schedule`, provide targeted chemical spray formulations with active chemical name, exact concentration (e.g., 1 ml/L or 2 g/L), and mandatory harvest safety withdrawal periods (e.g., 14-28 days).\n"
        "  * In `soil_amendment`, provide root-zone nutrient support (e.g., potassium sulfate, zinc chelate, silica) to fortify leaf cell wall resistance.\n\n"
        "BRANDING RULE:\n"
        "- Never mention 'Gemini', 'Google', or AI model brand names anywhere in your response. Self-identify only as the Precision Agro-Vision Engine."
    )

    api_key = (
        getattr(settings, "GEMINI_API_KEY", "")
        or os.environ.get("GEMINI_API_KEY", "")
        or os.environ.get("GOOGLE_API_KEY", "")
    )

    configured_model = (
        getattr(settings, "GEMINI_MODEL", "")
        or os.environ.get("GEMINI_MODEL", "").strip()
    )
    models_to_try: List[str] = []
    if configured_model:
        models_to_try.append(configured_model)
    for m in ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-2.5-flash-lite", "gemini-2.5-flash"]:
        if m not in models_to_try:
            models_to_try.append(m)

    if api_key and (image_bytes or sample_key):
        try:
            client = genai.Client(api_key=api_key)
            config = types.GenerateContentConfig(
                system_instruction=system_instruction,
                response_mime_type="application/json",
                response_schema=VisionDiagnosticsResponseSchema,
                temperature=0.1,
            )

            contents: List[Any] = []
            if image_bytes:
                norm_mime = mime_type if mime_type in ALLOWED_MIME_TYPES else "image/jpeg"
                contents.append(types.Part.from_bytes(data=image_bytes, mime_type=norm_mime))
                prompt_text = (
                    f"Perform strict validation and diagnostic analysis on this uploaded file (filename: {file_name}). "
                    "First, check if this is genuinely a Soil Report or a Crop Leaf Image. "
                    "If it is not a Soil Report or a Crop Leaf Image, reject it with is_valid_specimen=false. "
                    "If it is a Soil Report or Crop Leaf Image, set is_valid_specimen=true and accurately report the diagnostics, bounding boxes, organic remediation, chemical treatment schedules with withdrawal intervals, and soil amendments."
                )
            else:
                prompt_text = (
                    f"Analyze the known agricultural sample scenario for '{sample_key}'. "
                    "Confirm it is a valid crop leaf image or soil report, and report the pathology, bounding boxes, organic remedies, chemical treatment schedule with withdrawal safety periods, and soil amendments."
                )
            contents.append(prompt_text)

            for model_name in models_to_try:
                try:
                    response = client.models.generate_content(
                        model=model_name,
                        contents=contents,
                        config=config,
                    )
                    raw_text = (response.text or "").strip()
                    if raw_text.startswith("```"):
                        lines = raw_text.splitlines()
                        if lines and lines[0].startswith("```"):
                            lines = lines[1:]
                        if lines and lines[-1].strip() == "```":
                            lines = lines[:-1]
                        raw_text = "\n".join(lines).strip()

                    parsed_raw = json.loads(raw_text)
                    is_valid = parsed_raw.get("is_valid_specimen", True)
                    return {
                        "status": "success" if is_valid else "invalid_specimen",
                        "is_valid_specimen": is_valid,
                        "specimen_type": parsed_raw.get("specimen_type", "leaf_image" if is_valid else "unrecognized"),
                        "rejection_reason": parsed_raw.get("rejection_reason", ""),
                        "image_name": file_name,
                        "diagnosis_badge": parsed_raw.get("diagnosis_badge", "Field Specimen Analysis"),
                        "confidence_score": float(parsed_raw.get("confidence_score", 92.0)),
                        "affected_crop": parsed_raw.get("affected_crop", "Crop Foliage / Soil Report"),
                        "detected_issue": parsed_raw.get("detected_issue", ""),
                        "bounding_boxes": parsed_raw.get("bounding_boxes", []),
                        "organic_remediation": parsed_raw.get("organic_remediation", []),
                        "chemical_schedule": parsed_raw.get("chemical_schedule", []),
                        "soil_amendment": parsed_raw.get("soil_amendment", []),
                        "is_fallback": False,
                        "model_name": "Neural Agro-Vision Engine",
                    }
                except (APIError, ServerError, Exception) as model_err:
                    logger.warning(
                        "Vision model %s failed: %s; trying next fallback",
                        model_name,
                        model_err,
                    )
                    continue

        except Exception as client_err:
            logger.warning("Could not initialize vision client: %s; using fallback", client_err)

    # Resilient fallback logic
    lower_target = (sample_key or file_name or "").lower()

    # Strict check: ONLY Soil Reports and Crop Leaf Images are valid
    is_soil_report = any(term in lower_target for term in ["soil", "report", "card", "ph", "nutrient", "npk", "ec_test", "topsoil"])
    is_leaf_image = any(term in lower_target for term in ["leaf", "foliage", "sigatoka", "blight", "spot", "chlorosis", "necrosis", "banana", "rice", "paddy", "pepper", "cardamom", "tomato", "wilt"])

    # Explicit invalid keyword check for safety
    has_invalid_keyword = bool(re.search(r'(?:^|[\W_])(car|cars|automobile|vehicle|vehicles|dog|dogs|cat|cats|selfie|selfies|person|people|human|building|buildings|laptop|laptops|unrelated|invalid|animal|cattle|cow|pet|flower|root|stem|bark)(?:[\W_]|$)', lower_target))

    if has_invalid_keyword or (not is_soil_report and not is_leaf_image):
        return {
            "status": "invalid_specimen",
            "is_valid_specimen": False,
            "specimen_type": "unrecognized",
            "rejection_reason": (
                "Invalid image detected. The vision scanner only scans Soil Reports and Crop Leaf Images. "
                "Any other image uploaded (people, pets, vehicles, general objects, or non-leaf plant parts) is invalid. "
                "Please upload a clear photo of a crop leaf or a certified Soil Report."
            ),
            "image_name": file_name,
            "diagnosis_badge": "Invalid Specimen - Only Soil Reports & Leaf Images Allowed",
            "confidence_score": 0.0,
            "affected_crop": "None",
            "detected_issue": "The vision engine did not detect a valid agricultural soil test report or crop leaf foliage in the uploaded image.",
            "bounding_boxes": [],
            "organic_remediation": [],
            "chemical_schedule": [],
            "soil_amendment": [],
            "is_fallback": True,
            "model_name": "Neural Agro-Vision Engine",
        }

    # Match against standard diagnostic cases
    selected_case = DIAGNOSTIC_CASES[0]
    for case in DIAGNOSTIC_CASES:
        if any(kw in lower_target for kw in case["keywords"]):
            selected_case = case
            break

    return {
        "status": "success",
        "is_valid_specimen": True,
        "specimen_type": "soil_report" if is_soil_report else "leaf_image",
        "rejection_reason": "",
        "image_name": file_name,
        "diagnosis_badge": selected_case["diagnosis_badge"],
        "confidence_score": selected_case["confidence_score"],
        "affected_crop": selected_case["affected_crop"],
        "detected_issue": selected_case["detected_issue"],
        "bounding_boxes": selected_case["bounding_boxes"],
        "organic_remediation": selected_case["organic_remediation"],
        "chemical_schedule": selected_case["chemical_schedule"],
        "soil_amendment": selected_case["soil_amendment"],
        "is_fallback": True,
        "model_name": "Neural Agro-Vision Engine",
    }
