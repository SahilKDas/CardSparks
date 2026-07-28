import json
import os
from mistralai.client import Mistral

MODEL = "mistral-small-latest"
MAX_CARDS = 20
DEFAULT_CARDS = 8
LLM_TIMEOUT_MS = 9000

GEN_FLASHCARDS_SYSTEM_PROMPT = """You write flashcards for a study app.

Return JSON only, in this exact shape:
{"cards": [{"front": "question", "back": "answer"}]}

Rules:
- "front" is one clear question, under 120 characters. Exceptions can be made for flashcards that are used.
   for things such as language learning, where the front can be a word in one language, and the back, the word in another language.
- "back" is a complete but concise answer, under 300 characters. Same exceptions for the "front" apply here.
- No markdown, no numbering, no preamble.
- Produce exactly the number of cards requested. 
"""

GEN_FEEDBACK_SYSTEM_PROMPT = """You write flashcards for a study app, and you also analyze flashcard study session data to give feedback to the end user.

Return JSON only, in this exact shape:
{"feedback": "A short paragraph of feedback"}

Rules:
- The feedback should be under 300 characters.
- No markdown, no numbering, no preamble.

"""

class GenerationError(Exception):
    """Raised when cards could not be produced"""

def clamp_count(num_cards):
    try:
        count = int(num_cards)
    except (TypeError, ValueError):
        count = DEFAULT_CARDS
    return max(1, min(count, MAX_CARDS))

def extract_cards(payload):
    if isinstance(payload, dict):
        candidates = payload.get("cards") or payload.get("flashcards") or []
    elif isinstance(payload, list):
        candidates = payload
    else:
        candidates = []

    cards = []
    for item in candidates:
        if not isinstance(item, dict):
            continue
        front = str(item.get("front") or item.get("question") or "").strip()
        back = str(item.get("back") or item.get("answer") or "").strip()
        if front and back:
            cards.append({"front": front, "back": back})
    return cards

def extract_feedback(payload):
    if not isinstance(payload, dict):
        return ""
    feedback = str(payload.get("feedback") or "").strip()
    return feedback[:300]

def generate_cards(topic, num_cards=DEFAULT_CARDS):
    topic = (topic or "").strip()
    if not topic:
        raise GenerationError("A topic is required.")

    count = clamp_count(num_cards)

    api_key = os.getenv("MISTRAL_API_KEY")
    if not api_key:
        raise GenerationError("Card generation is not configured on the server (API key not provided).")

    client = Mistral(api_key=api_key)

    try:
        response = client.chat.complete(
            model=MODEL,
            messages=[
                {"role": "system", "content": GEN_FLASHCARDS_SYSTEM_PROMPT},
                {"role": "user", "content": f"Write {count} flashcards, about the following topic or, if formatted like a request, on the following request: {topic}"}
            ],
            response_format={"type": "json_object"},
            temperature=0.7,
            timeout_ms=LLM_TIMEOUT_MS
        )
    except Exception as err:
        raise GenerationError("Card generation is unavailable right now.") from err

    try:
        msg = response.choices[0].message
        payload = (json.loads(str(msg.content)) if msg else None)
    except (AttributeError, IndexError, TypeError, json.JSONDecodeError) as err:
        raise GenerationError("The card generator returned an unreadable response.") from err

    cards = extract_cards(payload)
    if not cards:
        raise GenerationError("The card generator returned no usable cards.")

    selected = cards[:count]
    return selected, len(selected)

def generate_feedback(data):
    if isinstance(data, str):
        data = data.strip()
    elif data:
        data = json.dumps(data, default=str)
    else:
        data = ""

    if not data:
        raise GenerationError("Data is not available.")

    api_key = os.getenv("MISTRAL_API_KEY")
    if not api_key:
        raise GenerationError("Feedback generation is not configured on the server (API key not provided).")

    client = Mistral(api_key=api_key)

    try:
        response = client.chat.complete(
            model=MODEL,
            messages=[
                {"role": "system", "content": GEN_FEEDBACK_SYSTEM_PROMPT},
                {"role": "user", "content": f"Analyze this study-session data and give the learner useful feedback: {data[:12000]}"},
            ],
            response_format={"type": "json_object"},
            temperature=0.4,
            timeout_ms=LLM_TIMEOUT_MS,
        )
    except Exception as err:
        raise GenerationError("Feedback generation is unavailable right now.") from err

    try:
        message = response.choices[0].message
        payload = json.loads(str(message.content)) if message else None
    except (AttributeError, IndexError, TypeError, json.JSONDecodeError) as err:
        raise GenerationError("The feedback generator returned an unreadable response.") from err

    feedback = extract_feedback(payload)
    if not feedback:
        raise GenerationError("The feedback generator returned no usable feedback.")
    return feedback
