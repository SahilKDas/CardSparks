"""Sidekick AI: a zero-dependency HTTP API, SQLite store, and static server."""

from __future__ import annotations

import json
import os
import re
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from statistics import mean
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote, urlencode, urlparse
from urllib.request import Request, urlopen

from backend.store import SidekickStore, now_iso

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = Path(os.environ.get("SIDEKICK_DB_PATH", ROOT / "backend" / "sidekick.db"))
EVENT_CACHE: dict[str, tuple[datetime, list[dict[str, Any]], str]] = {}


def load_dotenv() -> None:
    """Load simple KEY=VALUE pairs without adding a runtime dependency."""
    env_path = ROOT / ".env"
    if not env_path.exists():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


load_dotenv()


def init_db() -> None:
    SidekickStore(DB_PATH).init()


def store() -> SidekickStore:
    return SidekickStore(DB_PATH)


def fetch_json(url: str, *, headers: dict[str, str] | None = None, timeout: int = 8) -> Any:
    request_headers = {"User-Agent": "SidekickAI-Hackathon/1.0 (small-business-advisor)"}
    request_headers.update(headers or {})
    with urlopen(Request(url, headers=request_headers), timeout=timeout) as response:
        return json.load(response)


def post_json(url: str, payload: object, *, headers: dict[str, str], timeout: int = 25) -> Any:
    body = json.dumps(payload).encode("utf-8")
    request = Request(url, data=body, headers={"Content-Type": "application/json", **headers}, method="POST")
    with urlopen(request, timeout=timeout) as response:
        return json.load(response)


def clean_profile(payload: dict[str, Any]) -> dict[str, Any]:
    required = ("name", "type", "location")
    if any(not str(payload.get(key, "")).strip() for key in required):
        raise ValueError("Business name, type, and location are required.")
    sales = []
    for row in payload.get("sales", []):
        try:
            amount = round(float(row["amount"]), 2)
            parsed_date = date.fromisoformat(str(row["date"])[:10])
        except (KeyError, TypeError, ValueError):
            continue
        if 0 <= amount <= 10_000_000:
            sales.append({"date": parsed_date.isoformat(), "amount": amount})
    sales.sort(key=lambda row: row["date"])
    if len(sales) < 3:
        raise ValueError("At least three valid sales days are required.")
    return {
        "name": str(payload["name"]).strip()[:120],
        "type": str(payload["type"]).strip()[:120],
        "location": str(payload["location"]).strip()[:160],
        "goal": str(payload.get("goal", "Grow the business")).strip()[:160],
        "sales": sales[-365:],
    }


def summarize_sales(sales: list[dict[str, Any]]) -> dict[str, Any]:
    values = [float(row["amount"]) for row in sales]
    recent = values[-7:]
    previous = values[-14:-7]
    if not previous and len(values) >= 4:
        midpoint = len(values) // 2
        previous, recent = values[:midpoint], values[midpoint:]
    previous_average = mean(previous) if previous else mean(recent)
    trend = ((mean(recent) - previous_average) / previous_average * 100) if previous_average else 0
    by_weekday: dict[str, list[float]] = defaultdict(list)
    for row in sales:
        weekday = date.fromisoformat(row["date"]).strftime("%A")
        by_weekday[weekday].append(float(row["amount"]))
    best_day = max(by_weekday, key=lambda day_name: mean(by_weekday[day_name]))
    return {
        "total": round(sum(values)),
        "average": round(mean(recent)),
        "trend_percent": round(trend, 1),
        "best_day": best_day,
        "lowest_day": min(by_weekday, key=lambda day_name: mean(by_weekday[day_name])),
    }


def geocode(location: str) -> dict[str, Any]:
    # Open-Meteo's search works best with a city or postal code, not "City, ST".
    candidates = [location]
    if "," in location:
        candidates.append(location.split(",", 1)[0].strip())
    results = []
    for candidate in candidates:
        query = urlencode({"name": candidate, "count": 5, "language": "en", "format": "json"})
        data = fetch_json(f"https://geocoding-api.open-meteo.com/v1/search?{query}")
        results = data.get("results") or []
        if results:
            break
    if not results:
        raise ValueError(f"Could not locate {location}.")
    result = results[0]
    return {
        "latitude": result["latitude"], "longitude": result["longitude"],
        "city": result.get("name", location), "region": result.get("admin1", ""),
        "country_code": result.get("country_code", "US"), "timezone": result.get("timezone", "auto"),
        "live": True,
    }


WEATHER_LABELS = {
    0: "Clear sky", 1: "Mostly sunny", 2: "Partly cloudy", 3: "Overcast",
    45: "Foggy", 48: "Foggy", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
    61: "Light rain", 63: "Rain", 65: "Heavy rain", 71: "Light snow", 73: "Snow",
    75: "Heavy snow", 80: "Rain showers", 81: "Rain showers", 82: "Heavy showers",
    95: "Thunderstorms", 96: "Thunderstorms", 99: "Thunderstorms",
}


def weather_for(place: dict[str, Any]) -> dict[str, Any]:
    params = {
        "latitude": place["latitude"], "longitude": place["longitude"],
        "current": "temperature_2m,weather_code", "daily": "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
        "temperature_unit": "fahrenheit", "timezone": "auto", "forecast_days": 7,
    }
    data = fetch_json(f"https://api.open-meteo.com/v1/forecast?{urlencode(params)}")
    daily = data["daily"]
    forecast = []
    for index, iso_date in enumerate(daily["time"]):
        forecast.append({
            "date": iso_date,
            "day": "Today" if index == 0 else date.fromisoformat(iso_date).strftime("%a"),
            "high": daily["temperature_2m_max"][index], "low": daily["temperature_2m_min"][index],
            "code": daily["weather_code"][index], "rain": daily["precipitation_probability_max"][index] or 0,
        })
    code = int(data["current"]["weather_code"])
    return {
        "current_temp": data["current"]["temperature_2m"], "condition": WEATHER_LABELS.get(code, "Variable skies"),
        "high": forecast[0]["high"], "low": forecast[0]["low"], "precipitation": forecast[0]["rain"],
        "forecast": forecast,
    }


def fallback_weather() -> dict[str, Any]:
    today = date.today()
    daily = [
        {"date": (today + timedelta(days=i)).isoformat(), "day": "Today" if i == 0 else (today + timedelta(days=i)).strftime("%a"), "high": 73 + i % 3, "low": 56 + i % 2, "code": 61 if i == 2 else 2, "rain": 65 if i == 2 else 20}
        for i in range(7)
    ]
    return {"current_temp": 68, "condition": "Partly cloudy", "high": 73, "low": 56, "precipitation": 20, "forecast": daily}


def ticketmaster_events(place: dict[str, Any]) -> list[dict[str, Any]]:
    api_key = os.environ.get("TICKETMASTER_API_KEY", "").strip()
    if not api_key:
        return []
    start = datetime.now(timezone.utc).replace(microsecond=0)
    end = start + timedelta(days=7)
    params = {
        "apikey": api_key, "latlong": f'{place["latitude"]},{place["longitude"]}', "radius": 15,
        "unit": "miles", "size": 5, "sort": "date,asc",
        "startDateTime": start.isoformat().replace("+00:00", "Z"), "endDateTime": end.isoformat().replace("+00:00", "Z"),
    }
    data = fetch_json(f"https://app.ticketmaster.com/discovery/v2/events.json?{urlencode(params)}")
    events = []
    for event in (data.get("_embedded", {}).get("events", [])):
        start_data = event.get("dates", {}).get("start", {})
        event_date = date.fromisoformat(start_data.get("localDate", date.today().isoformat()))
        classification = (event.get("classifications") or [{}])[0]
        events.append({
            "name": event.get("name", "Local event"), "date": event_date.strftime("%a, %b %-d") if os.name != "nt" else event_date.strftime("%a, %b %#d"),
            "time": format_time(start_data.get("localTime")), "distance": "Within 15 mi",
            "category": classification.get("segment", {}).get("name", "Local event"), "opportunity": "high",
            "url": event.get("url", ""),
        })
    return events


def format_time(value: str | None) -> str:
    if not value:
        return "Time TBA"
    try:
        return datetime.strptime(value[:5], "%H:%M").strftime("%-I:%M %p")
    except (ValueError, OSError):
        try:
            return datetime.strptime(value[:5], "%H:%M").strftime("%#I:%M %p")
        except (ValueError, OSError):
            return value


def holiday_events(country_code: str) -> list[dict[str, Any]]:
    today, end = date.today(), date.today() + timedelta(days=7)
    data = fetch_json(f"https://date.nager.at/api/v3/PublicHolidays/{today.year}/{quote(country_code)}")
    events = []
    for holiday in data:
        holiday_date = date.fromisoformat(holiday["date"])
        if today <= holiday_date <= end and holiday.get("global", True):
            events.append({
                "name": holiday["localName"], "date": format_event_date(holiday_date), "time": "All day",
                "distance": "Community-wide", "category": "Public holiday", "opportunity": "medium",
            })
    return events


def format_event_date(value: date) -> str:
    result = value.strftime("%a, %b %d")
    return result.replace(" 0", " ")


def curated_demo_events(city: str) -> list[dict[str, Any]]:
    today = date.today()
    names = [
        ("Downtown Summer Night Market", 2, "5:00 PM", "Festival", "high", "0.8 mi"),
        (f"{city} Community Music Series", 4, "6:30 PM", "Community", "medium", "1.2 mi"),
        ("Weekend Makers & Farmers Market", 6, "9:00 AM", "Market", "high", "0.6 mi"),
    ]
    return [{"name": name, "date": format_event_date(today + timedelta(days=offset)), "time": event_time, "distance": distance, "category": category, "opportunity": opportunity} for name, offset, event_time, category, opportunity, distance in names]


def discover_events(place: dict[str, Any]) -> tuple[list[dict[str, Any]], str]:
    cache_key = f'{round(float(place.get("latitude", 0)), 2)}:{round(float(place.get("longitude", 0)), 2)}:{bool(os.environ.get("TICKETMASTER_API_KEY"))}'
    cached = EVENT_CACHE.get(cache_key)
    if cached and datetime.now(timezone.utc) - cached[0] < timedelta(minutes=15):
        return cached[1], f"{cached[2]} · cached {cached[0].strftime('%H:%M UTC')}"
    try:
        live = ticketmaster_events(place)
        if live:
            source = "Ticketmaster Discovery API · live"
            EVENT_CACHE[cache_key] = (datetime.now(timezone.utc), live, source)
            return live, source
    except (HTTPError, URLError, TimeoutError, ValueError, KeyError):
        pass
    try:
        holidays = holiday_events(place.get("country_code", "US"))
        if holidays:
            source = "Nager.Date public holidays · live"
            EVENT_CACHE[cache_key] = (datetime.now(timezone.utc), holidays, source)
            return holidays, source
    except (HTTPError, URLError, TimeoutError, ValueError, KeyError):
        pass
    events = curated_demo_events(place.get("city", "Local"))
    source = "Curated demo events · add TICKETMASTER_API_KEY for live listings"
    EVENT_CACHE[cache_key] = (datetime.now(timezone.utc), events, source)
    return events, source


def evidence_defaults(summary: dict[str, Any], weather: dict[str, Any], events: list[dict[str, Any]]) -> list[str]:
    rainiest = max(weather["forecast"], key=lambda day: day["rain"])
    event = events[0] if events else None
    defaults = [
        f"Recent sales trend: {summary['trend_percent']:+.1f}% with a ${summary['average']:,} daily average",
        f"{rainiest['day']} carries the week’s highest rain chance at {rainiest['rain']}%",
    ]
    if event:
        defaults.append(f"{event['name']} is {event['distance']} away on {event['date']}")
    return defaults


def fallback_recommendations(profile: dict[str, Any], summary: dict[str, Any], weather: dict[str, Any], events: list[dict[str, Any]], outcomes: list[dict[str, Any]]) -> list[dict[str, Any]]:
    business = profile["type"].lower()
    is_coffee = any(word in business for word in ("coffee", "bakery", "cafe"))
    product = "cold brew and grab-and-go pastries" if is_coffee else "your fastest-selling items"
    bundle = "a $9 drink-and-snack bundle" if is_coffee else "a limited event-day bundle"
    event = events[0] if events else {"name": "busy weekend", "date": "this weekend", "distance": "nearby"}
    rainiest = max(weather["forecast"], key=lambda day: day["rain"])
    direction = "up" if summary["trend_percent"] >= 0 else "down"
    trend_action = "Protect the momentum" if direction == "up" else "Win back a soft week"
    learned = outcomes[0] if outcomes else None
    learned_outcome = learned.get("outcome") if learned else None
    learned_lift = learned_outcome.get("lift_amount", 0) if learned_outcome else 0
    third = {
        "id": "repeat-learned-win" if learned_outcome else "sales-momentum",
        "priority": "Sidekick learned" if learned_outcome else "This week", "icon": "spark",
        "title": f"Repeat the play that added ${learned_lift:,.0f}" if learned_outcome and learned_lift > 0 else f"{trend_action} with one measurable offer",
        "action": f"Reuse the strongest part of “{learned['title']}” in a two-hour window, then log sales again so Sidekick can separate a repeatable play from a one-off win." if learned_outcome else f"Run one two-hour offer tied to your goal: “{profile['goal']}.” Track it separately so next week’s briefing can tell you if it earned a repeat.",
        "why": f"The prior action finished ${learned_lift:,.0f} versus its comparable-day baseline · the result was marked {learned_outcome['helped']}" if learned_outcome else f"Recent sales are {direction} {abs(summary['trend_percent'])}% · daily average is ${summary['average']:,}",
        "signals": ["sales"], "impact": "Compounding insight" if learned_outcome else "Easy to measure",
        "evidence": [f"Observed sales: ${learned_outcome['observed_sales']:,.0f}" if learned_outcome else f"Recent sales trend: {summary['trend_percent']:+.1f}%", f"Comparable-day baseline: ${learned_outcome['baseline_sales']:,.0f}" if learned_outcome else f"Daily average: ${summary['average']:,}"],
        "confidence": "high" if learned_outcome and learned_outcome["helped"] == "yes" else "medium",
        "success_metric": "Beat the comparable-day baseline again" if learned_outcome else "Revenue during the two-hour offer window",
    }
    return [
        {"id": "event-opportunity", "priority": "Best opportunity", "icon": "event", "title": f"Get in front of the {event['name']} crowd", "action": f"Prepare 20% more {product} before {event['date']} and put {bundle} on a sidewalk sign. Add a bounce-back offer for the following weekday.", "why": f"{event['name']} · {event['distance']} · {summary['best_day']} is already your strongest day", "signals": ["event", "sales"], "impact": "High upside", "evidence": [f"{event['name']} is {event['distance']} away on {event['date']}", f"{summary['best_day']} is the strongest sales day in the uploaded history"], "confidence": "high", "success_metric": "Event-day sales versus the current daily average"},
        {"id": "weather-plan", "priority": "Plan ahead", "icon": "rain", "title": f"Build a {rainiest['day']} rain plan now", "action": "Schedule a morning loyalty offer the night before and move your most comforting, high-margin products to the front. Staff lightly after the rush if foot traffic softens.", "why": f"{rainiest['rain']}% rain chance on {rainiest['day']} · {summary['lowest_day']} is your softest sales day", "signals": ["weather", "sales"], "impact": "Protects demand", "evidence": [f"{rainiest['rain']}% rain chance on {rainiest['day']}", f"{summary['lowest_day']} is the lowest-performing weekday in the sales history"], "confidence": "medium", "success_metric": "Sales versus the usual comparable weekday"},
        third,
    ]


def recommendation_context(profile: dict[str, Any], summary: dict[str, Any], weather: dict[str, Any], events: list[dict[str, Any]], outcomes: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "business": {"type": profile["type"], "location": profile["location"], "goal": profile["goal"]},
        "sales_summary": summary, "recent_sales": profile["sales"][-14:], "weather": weather,
        "events": events, "measured_outcomes": outcomes,
    }


def advisor_prompt(context: dict[str, Any]) -> str:
    return """You are Sidekick, a warm, commercially sharp co-pilot for one small business owner. Analyze only the supplied sales × weather × local-events context and measured past outcomes. Return ONLY JSON with a `recommendations` array of exactly 3 objects. Every object requires: id (slug), priority (2-4 words), icon (event, rain, or spark), title (under 11 words), action (1-2 concrete sentences), why (one sentence citing exact signals), signals (sales/weather/event), impact (2-4 words), evidence (2-3 exact factual strings from context), confidence (high/medium/exploratory), success_metric (one measurable result). Never invent facts. If measured outcomes exist, one recommendation must explicitly learn from one.\n\nCONTEXT:\n""" + json.dumps(context, separators=(",", ":"))


def parse_recommendation_response(text: str) -> list[dict[str, Any]] | None:
    try:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        parsed = json.loads(match.group(0) if match else text)
        items = parsed.get("recommendations", [])
        return items if len(items) == 3 and all(isinstance(item, dict) for item in items) else None
    except (ValueError, json.JSONDecodeError, AttributeError):
        return None


def normalize_recommendations(items: list[dict[str, Any]] | None, defaults: list[str]) -> list[dict[str, Any]] | None:
    if not items or len(items) != 3:
        return None
    normalized = []
    for index, item in enumerate(items):
        if not item.get("title") or not item.get("action") or not item.get("why"):
            return None
        signals = [signal for signal in item.get("signals", []) if signal in {"sales", "weather", "event"}]
        evidence = [str(value)[:220] for value in item.get("evidence", []) if str(value).strip()][:3]
        while len(evidence) < 2:
            evidence.append(defaults[(index + len(evidence)) % len(defaults)])
        identifier = re.sub(r"[^a-z0-9]+", "-", str(item.get("id") or item["title"]).lower()).strip("-")
        normalized.append({
            "id": identifier[:80] or f"recommendation-{index + 1}", "priority": str(item.get("priority", "Worth doing"))[:40],
            "icon": item.get("icon") if item.get("icon") in {"event", "rain", "spark"} else "spark",
            "title": str(item["title"])[:180], "action": str(item["action"])[:900], "why": str(item["why"])[:500],
            "signals": signals or ["sales"], "impact": str(item.get("impact", "Measurable"))[:40], "evidence": evidence,
            "confidence": item.get("confidence") if item.get("confidence") in {"high", "medium", "exploratory"} else "medium",
            "success_metric": str(item.get("success_metric", "Sales versus the comparable-day baseline"))[:240],
        })
    return normalized


def anthropic_recommendations(context: dict[str, Any]) -> list[dict[str, Any]] | None:
    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        return None
    payload = {"model": os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514"), "max_tokens": 1500, "temperature": 0.3, "messages": [{"role": "user", "content": advisor_prompt(context)}]}
    try:
        response = post_json("https://api.anthropic.com/v1/messages", payload, headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"})
        text = "".join(block.get("text", "") for block in response.get("content", []) if block.get("type") == "text")
        return parse_recommendation_response(text)
    except (HTTPError, URLError, TimeoutError, ValueError, KeyError, json.JSONDecodeError) as exc:
        print(f"[sidekick] Anthropic unavailable: {exc}")
    return None


def gemini_recommendations(context: dict[str, Any]) -> list[dict[str, Any]] | None:
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None
    model = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")
    fields = ("id", "priority", "icon", "title", "action", "why", "signals", "impact", "evidence", "confidence", "success_metric")
    properties = {
        key: {"type": "array", "items": {"type": "string"}} if key in {"signals", "evidence"} else {"type": "string"}
        for key in fields
    }
    schema = {
        "type": "object",
        "properties": {
            "recommendations": {
                "type": "array", "minItems": 3, "maxItems": 3,
                "items": {"type": "object", "properties": properties, "required": list(fields)},
            }
        },
        "required": ["recommendations"],
    }
    payload = {"contents": [{"role": "user", "parts": [{"text": advisor_prompt(context)}]}], "generationConfig": {"temperature": 0.3, "responseMimeType": "application/json", "responseSchema": schema}}
    try:
        response = post_json(f"https://generativelanguage.googleapis.com/v1beta/models/{quote(model)}:generateContent?key={quote(api_key)}", payload, headers={})
        text = response["candidates"][0]["content"]["parts"][0]["text"]
        return parse_recommendation_response(text)
    except (HTTPError, URLError, TimeoutError, ValueError, KeyError, IndexError, json.JSONDecodeError) as exc:
        print(f"[sidekick] Gemini unavailable: {exc}")
    return None


def advisor_recommendations(profile: dict[str, Any], summary: dict[str, Any], weather: dict[str, Any], events: list[dict[str, Any]], outcomes: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], str]:
    context = recommendation_context(profile, summary, weather, events, outcomes)
    defaults = evidence_defaults(summary, weather, events)
    provider = "local" if os.environ.get("SIDEKICK_OFFLINE", "").lower() in {"1", "true", "yes"} else os.environ.get("AI_PROVIDER", "auto").strip().lower()
    candidates = []
    if provider in {"auto", "anthropic"}:
        candidates.append(("anthropic", anthropic_recommendations))
    if provider in {"auto", "gemini"}:
        candidates.append(("gemini", gemini_recommendations))
    for name, implementation in candidates:
        normalized = normalize_recommendations(implementation(context), defaults)
        if normalized:
            return normalized, name
    local = fallback_recommendations(profile, summary, weather, events, outcomes)
    return normalize_recommendations(local, defaults) or local, "local"


def launch_kit_context(action: dict[str, Any]) -> dict[str, Any]:
    """Return the intentionally narrow, aggregated context sent to an AI provider."""
    sidekick_store = store()
    profile = sidekick_store.get_profile(action["profile_name"]) or {}
    return {
        "business_type": str(profile.get("type", "Small business"))[:120],
        "business_goal": str(profile.get("goal", "Grow the business"))[:160],
        "action": str(action["action"])[:1200],
        "title": str(action["title"])[:240],
        "evidence": [str(item)[:220] for item in action.get("evidence", [])][:3],
        "signals": [item for item in action.get("signals", []) if item in {"sales", "weather", "event"}],
        "scheduled_date": action["scheduled_for"],
        "success_metric": str(action.get("success_metric", "Sales versus the comparable-day baseline"))[:300],
        "baseline_sales": sidekick_store.baseline_for(action["profile_name"], action["scheduled_for"]),
    }


def local_launch_kit(context: dict[str, Any]) -> dict[str, Any]:
    """Create a complete, fast kit without network access or ungrounded commercial claims."""
    action = context["action"].strip()
    evidence = " ".join(context.get("evidence", []))
    signals = context.get("signals", [])
    if "event" in signals:
        offer_name = "Festival Fuel"
        audience = "People heading to the nearby event"
        headline = "FESTIVAL FUEL"
        body = "Fuel up before the nearby event"
        launch_time = "15:30"
        social = f"Heading to the nearby event? Stop in first. {action}"
    elif "weather" in signals or "rain" in (action + evidence).lower():
        offer_name = "Rainy Day Reset"
        audience = "Customers adjusting their routine for the weather"
        headline = "RAINY DAY RESET"
        body = "A thoughtful stop for a rainy day"
        launch_time = "07:00"
        social = f"Rain in the plan? We have a timely reason to stop in. {action}"
    else:
        offer_name = "This Week's Smart Move"
        audience = "Regular and nearby customers"
        headline = "TODAY'S SMART MOVE"
        body = "A timely reason to stop in today"
        launch_time = "09:00"
        social = f"A timely update from your neighborhood business: {action}"
    sms = social if len(social) <= 157 else social[:156].rstrip(" ,.;:") + "…"
    first_step = action.split(".", 1)[0].strip()
    operations = [
        {"task": first_step or "Prepare the planned offer", "timing": "Before launch", "owner": "Shift lead"},
        {"task": "Set up the customer-facing sign", "timing": "Before launch", "owner": "Front counter"},
        {"task": "Record sales against the comparable-day baseline", "timing": "End of day", "owner": "Owner"},
    ]
    return {
        "offer_name": offer_name,
        "audience": audience,
        "schedule": {"date": context["scheduled_date"], "time": launch_time, "label": "Suggested launch time"},
        "customer_copy": {"social": social, "sms": sms, "sign_headline": headline, "sign_body": body},
        "operations": operations,
        "measurement": {"metric": context["success_metric"], "baseline_sales": context["baseline_sales"]},
    }


def launch_kit_prompt(context: dict[str, Any]) -> str:
    return """You are Sidekick, a practical campaign assistant for a small business. Turn the supplied planned action into one ready-to-use Launch Kit. Return ONLY JSON with: offer_name, audience, schedule {date, time in HH:MM, label}, customer_copy {social, sms under 160 characters, sign_headline, sign_body}, operations (2-5 objects with task, timing, owner), and measurement {metric, baseline_sales}. Use only the supplied facts. Do not invent discounts, event partnerships, prices, quantities, dates, or performance claims. A price, discount, or quantity may appear only when it already appears verbatim in the action or evidence. Do not imply anything has been published, scheduled remotely, or sent.\n\nAGGREGATED CONTEXT:\n""" + json.dumps(context, separators=(",", ":"))


def parse_launch_kit_response(text: str) -> dict[str, Any] | None:
    try:
        match = re.search(r"\{.*\}", text, re.DOTALL)
        parsed = json.loads(match.group(0) if match else text)
        if isinstance(parsed.get("launch_kit"), dict):
            parsed = parsed["launch_kit"]
        return parsed if isinstance(parsed, dict) else None
    except (ValueError, json.JSONDecodeError, AttributeError):
        return None


def _contains_unsupported_claim(kit: dict[str, Any], context: dict[str, Any]) -> bool:
    source = " ".join([context.get("action", ""), *context.get("evidence", [])]).lower()
    claims = json.dumps({
        "offer_name": kit.get("offer_name"), "audience": kit.get("audience"),
        "customer_copy": kit.get("customer_copy"), "operations": kit.get("operations"),
    }).lower()
    tokens = re.findall(r"\$\s?\d[\d,.]*|\b\d+(?:\.\d+)?%", claims)
    if any(token.replace(" ", "") not in source.replace(" ", "") for token in tokens):
        return True
    guarded_words = ("discount", "free ", "partnered", "official partner", "sponsored")
    return any(word in claims and word not in source for word in guarded_words)


def normalize_launch_kit(raw: dict[str, Any] | None, action_id: int, provider: str, context: dict[str, Any]) -> dict[str, Any] | None:
    if not isinstance(raw, dict) or _contains_unsupported_claim(raw, context):
        return None
    schedule, copy, measurement = raw.get("schedule"), raw.get("customer_copy"), raw.get("measurement")
    operations = raw.get("operations")
    if not all(isinstance(value, dict) for value in (schedule, copy, measurement)) or not isinstance(operations, list):
        return None
    required_copy = ("social", "sms", "sign_headline", "sign_body")
    if not raw.get("offer_name") or not raw.get("audience") or any(not str(copy.get(key, "")).strip() for key in required_copy):
        return None
    normalized_operations = []
    for item in operations[:5]:
        if not isinstance(item, dict) or not all(str(item.get(key, "")).strip() for key in ("task", "timing", "owner")):
            continue
        normalized_operations.append({key: str(item[key]).strip()[:300 if key == "task" else 100] for key in ("task", "timing", "owner")})
    if len(normalized_operations) < 2:
        return None
    schedule_date = str(schedule.get("date", ""))[:10]
    try:
        date.fromisoformat(schedule_date)
    except ValueError:
        schedule_date = context["scheduled_date"]
    schedule_time = str(schedule.get("time", ""))[:5]
    if not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", schedule_time):
        return None
    sms = str(copy["sms"]).strip()[:160]
    return {
        "action_id": action_id,
        "provider": provider,
        "offer_name": str(raw["offer_name"]).strip()[:120],
        "audience": str(raw["audience"]).strip()[:240],
        "schedule": {"date": schedule_date, "time": schedule_time, "label": str(schedule.get("label") or "Suggested launch time")[:100]},
        "customer_copy": {
            "social": str(copy["social"]).strip()[:600], "sms": sms,
            "sign_headline": str(copy["sign_headline"]).strip()[:80], "sign_body": str(copy["sign_body"]).strip()[:180],
        },
        "operations": normalized_operations,
        "measurement": {
            "metric": str(measurement.get("metric") or context["success_metric"])[:300],
            "baseline_sales": round(float(context["baseline_sales"]), 2),
        },
        "generated_at": now_iso(),
    }


def anthropic_launch_kit(context: dict[str, Any]) -> dict[str, Any] | None:
    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        return None
    payload = {"model": os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514"), "max_tokens": 1400, "temperature": 0.2, "messages": [{"role": "user", "content": launch_kit_prompt(context)}]}
    try:
        response = post_json("https://api.anthropic.com/v1/messages", payload, headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"}, timeout=8)
        text = "".join(block.get("text", "") for block in response.get("content", []) if block.get("type") == "text")
        return parse_launch_kit_response(text)
    except (HTTPError, URLError, TimeoutError, ValueError, KeyError, json.JSONDecodeError) as exc:
        print(f"[sidekick] Anthropic Launch Kit unavailable: {exc}")
    return None


def gemini_launch_kit(context: dict[str, Any]) -> dict[str, Any] | None:
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None
    model = os.environ.get("GEMINI_MODEL", "gemini-3.6-flash")
    text_field = {"type": "string"}
    schema = {
        "type": "object", "required": ["offer_name", "audience", "schedule", "customer_copy", "operations", "measurement"],
        "properties": {
            "offer_name": text_field, "audience": text_field,
            "schedule": {"type": "object", "properties": {"date": text_field, "time": text_field, "label": text_field}, "required": ["date", "time", "label"]},
            "customer_copy": {"type": "object", "properties": {key: text_field for key in ("social", "sms", "sign_headline", "sign_body")}, "required": ["social", "sms", "sign_headline", "sign_body"]},
            "operations": {"type": "array", "minItems": 2, "maxItems": 5, "items": {"type": "object", "properties": {key: text_field for key in ("task", "timing", "owner")}, "required": ["task", "timing", "owner"]}},
            "measurement": {"type": "object", "properties": {"metric": text_field, "baseline_sales": {"type": "number"}}, "required": ["metric", "baseline_sales"]},
        },
    }
    payload = {"contents": [{"role": "user", "parts": [{"text": launch_kit_prompt(context)}]}], "generationConfig": {"temperature": 0.2, "responseMimeType": "application/json", "responseSchema": schema}}
    try:
        response = post_json(f"https://generativelanguage.googleapis.com/v1beta/models/{quote(model)}:generateContent?key={quote(api_key)}", payload, headers={}, timeout=8)
        return parse_launch_kit_response(response["candidates"][0]["content"]["parts"][0]["text"])
    except (HTTPError, URLError, TimeoutError, ValueError, KeyError, IndexError, json.JSONDecodeError) as exc:
        print(f"[sidekick] Gemini Launch Kit unavailable: {exc}")
    return None


def generate_launch_kit(action_id: int, refresh: bool = False) -> dict[str, Any]:
    sidekick_store = store()
    existing = sidekick_store.get_launch_kit(action_id)
    if existing and not refresh:
        return existing
    action = sidekick_store.get_action(action_id)
    context = launch_kit_context(action)
    provider = "local" if os.environ.get("SIDEKICK_OFFLINE", "").lower() in {"1", "true", "yes"} else os.environ.get("AI_PROVIDER", "auto").strip().lower()
    candidates = []
    if provider in {"auto", "anthropic"}:
        candidates.append(("anthropic", anthropic_launch_kit))
    if provider in {"auto", "gemini"}:
        candidates.append(("gemini", gemini_launch_kit))
    for name, implementation in candidates:
        normalized = normalize_launch_kit(implementation(context), action_id, name, context)
        if normalized:
            return sidekick_store.save_launch_kit(action_id, name, normalized)
    local = normalize_launch_kit(local_launch_kit(context), action_id, "local", context)
    if not local:
        raise ValueError("Sidekick could not build a safe Launch Kit for this action.")
    return sidekick_store.save_launch_kit(action_id, "local", local)


def create_briefing(payload: dict[str, Any]) -> dict[str, Any]:
    profile = clean_profile(payload)
    summary = summarize_sales(profile["sales"])
    sidekick_store = store()
    sidekick_store.save_profile(profile)
    outcomes = sidekick_store.recent_outcomes(profile["name"])
    offline = os.environ.get("SIDEKICK_OFFLINE", "").lower() in {"1", "true", "yes"}
    live_weather = not offline
    if offline:
        place = {"city": profile["location"].split(",")[0], "country_code": "US", "latitude": 45.52, "longitude": -122.68}
        weather, live_weather = fallback_weather(), False
        events, events_source = curated_demo_events(place["city"]), "Curated demo events · offline recording mode"
    else:
        try:
            place = geocode(profile["location"])
            weather = weather_for(place)
        except (HTTPError, URLError, TimeoutError, ValueError, KeyError) as exc:
            print(f"[sidekick] Live weather unavailable; using demo weather: {exc}")
            place = {"city": profile["location"].split(",")[0], "country_code": "US", "latitude": 45.52, "longitude": -122.68}
            weather, live_weather = fallback_weather(), False
        events, events_source = discover_events(place)
    recommendations, advisor_mode = advisor_recommendations(profile, summary, weather, events, outcomes)
    generated_at = now_iso()
    recent_win = next((item for item in outcomes if item.get("outcome") and item["outcome"]["lift_amount"] > 0), outcomes[0] if outcomes else None)
    result = {
        "generated_at": generated_at, "live_weather": live_weather, "location": place,
        "weather": weather, "events": events, "events_source": events_source, "events_updated_at": generated_at,
        "sales": profile["sales"], "sales_summary": summary,
        "recommendations": recommendations, "advisor_mode": advisor_mode,
        "recent_win": recent_win, "learning_count": len(outcomes),
    }
    sidekick_store.save_briefing(profile["name"], advisor_mode, recommendations, generated_at)
    return result


def briefing_history(profile_name: str) -> list[dict[str, Any]]:
    return store().history(profile_name)


def demo_profile() -> dict[str, Any]:
    amounts = [1180, 1260, 1135, 1320, 1580, 1810, 1475, 1210, 1295, 1370, 1415, 1680, 1940, 1525]
    today = date.today()
    sales = [{"date": (today - timedelta(days=14 - index)).isoformat(), "amount": amount} for index, amount in enumerate(amounts)]
    return {
        "name": "Juniper Coffee Co.", "type": "Independent coffee shop", "location": "Portland, OR",
        "goal": "Grow weekday foot traffic", "sales": sales,
    }


def reset_demo_story() -> dict[str, Any]:
    profile = demo_profile()
    sidekick_store = store()
    sidekick_store.reset_business(profile["name"])
    sidekick_store.save_profile(profile)
    scheduled_for = (date.today() - timedelta(days=1)).isoformat()
    recommendation = {
        "id": "rainy-day-double-points", "title": "Make rainy mornings feel intentional",
        "action": "Run Rainy Day Double Points from 7–10 AM and feature the maple oat latte at the register.",
        "why": "Rain was forecast on a historically soft weekday.", "signals": ["weather", "sales"],
        "evidence": ["Rain was forecast during the morning commute", "The comparable weekday trailed the shop’s daily average"],
        "confidence": "medium", "success_metric": "Sales versus the comparable-day baseline",
    }
    action = sidekick_store.create_action({"profile_name": profile["name"], "recommendation": recommendation, "scheduled_for": scheduled_for, "is_demo": True})
    baseline = sidekick_store.baseline_for(profile["name"], scheduled_for)
    completed = sidekick_store.record_outcome(action["id"], {"observed_sales": baseline + 210, "helped": "yes", "note": "Morning regulars responded well; keep the offer limited to rainy commutes."})
    briefing = create_briefing(profile)
    return {"profile": profile, "seeded_action": completed, "briefing": briefing, "demo_data": True}


class SidekickHandler(BaseHTTPRequestHandler):
    server_version = "SidekickAI/2.0"

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            self.send_json(200, {"status": "ok", "service": "sidekick", "version": "2.0", "ai_provider": os.environ.get("AI_PROVIDER", "auto"), "offline": os.environ.get("SIDEKICK_OFFLINE", "").lower() in {"1", "true", "yes"}})
        elif parsed.path == "/api/history":
            business = parse_qs(parsed.query).get("business", [""])[0][:120]
            self.send_json(200, {"history": briefing_history(business)})
        elif parsed.path == "/api/actions":
            business = parse_qs(parsed.query).get("business", [""])[0][:120]
            self.send_json(200, {"actions": store().list_actions(business)})
        elif match := re.fullmatch(r"/api/actions/(\d+)/launch-kit", parsed.path):
            try:
                kit = store().get_launch_kit(int(match.group(1)))
            except ValueError:
                self.send_json(404, {"error": "Action not found."})
                return
            if kit:
                self.send_json(200, kit)
            else:
                self.send_json(404, {"error": "Launch Kit not found. Build it from the Playbook first."})
        else:
            self.serve_frontend(parsed.path)

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        try:
            payload = self.read_json()
            if path == "/api/briefing":
                self.send_json(200, create_briefing(payload))
            elif path == "/api/actions":
                self.send_json(201, store().create_action(payload))
            elif path == "/api/demo/reset":
                self.send_json(200, reset_demo_story())
            elif match := re.fullmatch(r"/api/actions/(\d+)/launch-kit", path):
                self.send_json(200, generate_launch_kit(int(match.group(1)), bool(payload.get("refresh", False))))
            elif match := re.fullmatch(r"/api/actions/(\d+)/outcome", path):
                self.send_json(200, store().record_outcome(int(match.group(1)), payload))
            else:
                self.send_json(404, {"error": "Not found"})
        except (ValueError, json.JSONDecodeError) as exc:
            self.send_json(400, {"error": str(exc)})
        except Exception as exc:  # keep demo server responsive and surface useful error
            print(f"[sidekick] Unhandled briefing error: {exc}")
            self.send_json(500, {"error": "Sidekick hit a temporary problem. Please refresh the briefing."})

    def do_PATCH(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        try:
            payload = self.read_json()
            match = re.fullmatch(r"/api/actions/(\d+)", path)
            if not match:
                self.send_json(404, {"error": "Not found"}); return
            self.send_json(200, store().update_action(int(match.group(1)), str(payload.get("status", ""))))
        except (ValueError, json.JSONDecodeError) as exc:
            self.send_json(400, {"error": str(exc)})
        except Exception as exc:
            print(f"[sidekick] Unhandled action error: {exc}")
            self.send_json(500, {"error": "Sidekick could not update that action."})

    def read_json(self) -> dict[str, Any]:
        length = min(int(self.headers.get("Content-Length", "0")), 2_000_000)
        payload = json.loads(self.rfile.read(length) or b"{}")
        if not isinstance(payload, dict):
            raise ValueError("Request body must be a JSON object.")
        return payload

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204); self.send_cors_headers(); self.end_headers()

    def send_cors_headers(self) -> None:
        origin = self.headers.get("Origin", "")
        if origin in {"http://localhost:5173", "http://127.0.0.1:5173"}:
            self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")

    def send_json(self, status: int, payload: object) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status); self.send_header("Content-Type", "application/json; charset=utf-8"); self.send_header("Content-Length", str(len(body))); self.send_cors_headers(); self.end_headers(); self.wfile.write(body)

    def serve_frontend(self, path: str) -> None:
        dist = (ROOT / "dist").resolve()
        requested = (dist / path.lstrip("/")).resolve()
        target = requested if requested.is_file() and (requested == dist or dist in requested.parents) else dist / "index.html"
        if not target.is_file():
            self.send_json(404, {"error": "Frontend not built. Run npm run build."}); return
        mime = {".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".svg": "image/svg+xml"}.get(target.suffix, "application/octet-stream")
        body = target.read_bytes(); self.send_response(200); self.send_header("Content-Type", mime); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)

    def log_message(self, fmt: str, *args: object) -> None:
        print(f"[sidekick] {fmt % args}")


def create_server(host: str = "127.0.0.1", port: int = 8000) -> ThreadingHTTPServer:
    init_db()
    return ThreadingHTTPServer((host, port), SidekickHandler)


if __name__ == "__main__":
    print("Sidekick AI is running at http://localhost:8000")
    create_server().serve_forever()
