import re
from typing import Dict, Any, Tuple
from app.schemas.voice import VoiceInterpretRequest, VoiceInterpretResponse


def interpret_voice_query(request: VoiceInterpretRequest) -> VoiceInterpretResponse:
    """
    Decode voice query or transcribed speech into structured platform intents.
    Supports English, Tamil, and Tanglish phrases.
    Enforces the Trust Rule: always returns confirmation prompt before execution.
    """
    raw_text = request.transcription.strip()
    text_lower = raw_text.lower()

    detected_language = "en"
    # Detect Tamil unicode or Tanglish markers
    if any("\u0b80" <= c <= "\u0bff" for c in raw_text):
        detected_language = "ta"
    elif any(w in text_lower for w in ["enakku", "irukku", "thevai", "venum", "kedaikkuma", "neram", "kudunga"]):
        detected_language = "ta-Latn"  # Tanglish

    intent = "general_question"
    extracted_params: Dict[str, Any] = {}
    action_payload: Dict[str, Any] = {}
    confirmation_msg = f"You said: \"{raw_text}\"\n\nIs this correct?"

    # 1. Weekly available hours intent
    # e.g., "I have 5 hours this week", "Enakku 5 hours irukku this week"
    if "hour" in text_lower or "neram" in text_lower or "mani" in text_lower:
        nums = re.findall(r"\b\d+(?:\.\d+)?\b", raw_text)
        if not nums:
            # Word number mapping
            word_map = {"one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10}
            for word, val in word_map.items():
                if word in text_lower:
                    nums = [str(val)]
                    break
        if nums:
            hours = float(nums[0])
            intent = "weekly_available_hours"
            extracted_params = {"hours": hours}
            action_payload = {"action": "UPDATE_PLANNER_HOURS", "hours": hours}
            confirmation_msg = f"You said: \"{raw_text}\"\n\nUpdate your weekly available planning time to {hours:g} hours? Is this correct?"

    # 2. Funding goal intent
    # e.g., "I need around sixty thousand rupees for my fees", "₹60,000 venum"
    elif any(term in text_lower for term in ["rupee", "fees", "funding", "gap", "thousand", "lakh", "venum", "thevai"]):
        amount = None
        if "sixty thousand" in text_lower or "60,000" in text_lower or "60000" in text_lower:
            amount = 60000.0
        elif "fifty thousand" in text_lower or "50,000" in text_lower or "50000" in text_lower:
            amount = 50000.0
        elif "one lakh" in text_lower or "1,00,000" in text_lower:
            amount = 100000.0
        else:
            nums = re.findall(r"\b\d+(?:,\d+)?\b", raw_text.replace(",", ""))
            if nums:
                amount = float(nums[0])

        if amount:
            intent = "funding_goal"
            extracted_params = {"target_funding": amount}
            action_payload = {"action": "UPDATE_TARGET_FUNDING", "target_funding": amount}
            confirmation_msg = f"You said: \"{raw_text}\"\n\nSet your target funding goal to ₹{amount:,.0f}? Is this correct?"

    # 3. Blocker inquiry
    elif any(term in text_lower for term in ["block", "document", "thadukku", "pending"]):
        intent = "blocker_inquiry"
        confirmation_msg = f"You asked: \"{raw_text}\"\n\nWould you like me to inspect your active application blockers?"
        action_payload = {"action": "NAVIGATE_OR_QUERY", "destination": "/documents"}

    # 4. Scholarship search
    elif any(term in text_lower for term in ["scholarship", "apply", "eligible", "finder", "thedu"]):
        intent = "scholarship_search"
        confirmation_msg = f"You asked: \"{raw_text}\"\n\nSearch scholarships matching your student profile?"
        action_payload = {"action": "NAVIGATE_OR_QUERY", "destination": "/discover"}

    return VoiceInterpretResponse(
        interpreted_text=raw_text,
        detected_language=detected_language,
        intent=intent,
        extracted_params=extracted_params,
        requires_confirmation=True,
        confirmation_message=confirmation_msg,
        action_payload=action_payload
    )
