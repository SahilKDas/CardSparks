"""Sidekick AI: a zero-dependency HTTP API, SQLite store, and static server."""

from __future__ import annotations

import json
import os
import re
import sqlite3
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from statistics import mean
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, quote, urlencode, urlparse
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = Path(os.environ.get("SIDEKICK_DB_PATH", ROOT / "backend" / "sidekick.db"))


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
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(DB_PATH) as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS profiles (
                name TEXT PRIMARY KEY,
                payload TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS briefings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_name TEXT NOT NULL,
                generated_at TEXT NOT NULL,
                advisor_mode TEXT NOT NULL,
                recommendations TEXT NOT NULL
            );
            """
        )


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
    try:
        live = ticketmaster_events(place)
        if live:
            return live, "Ticketmaster Discovery API · live"
    except (HTTPError, URLError, TimeoutError, ValueError, KeyError):
        pass
    try:
        holidays = holiday_events(place.get("country_code", "US"))
        if holidays:
            return holidays, "Nager.Date public holidays · live"
    except (HTTPError, URLError, TimeoutError, ValueError, KeyError):
        pass
    return curated_demo_events(place.get("city", "Local")), "Curated demo events · add TICKETMASTER_API_KEY for live listings"


def fallback_recommendations(profile: dict[str, Any], summary: dict[str, Any], weather: dict[str, Any], events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    business = profile["type"].lower()
    is_coffee = any(word in business for word in ("coffee", "bakery", "cafe"))
    product = "cold brew and grab-and-go pastries" if is_coffee else "your fastest-selling items"
    bundle = "a $9 drink-and-snack bundle" if is_coffee else "a limited event-day bundle"
    event = events[0] if events else {"name": "busy weekend", "date": "this weekend", "distance": "nearby"}
    rainiest = max(weather["forecast"], key=lambda day: day["rain"])
    direction = "up" if summary["trend_percent"] >= 0 else "down"
    trend_action = "Protect the momentum" if direction == "up" else "Win back a soft week"
    return [
        {"id": "event-opportunity", "priority": "Best opportunity", "icon": "event", "title": f"Get in front of the {event['name']} crowd", "action": f"Prepare 20% more {product} before {event['date']} and put {bundle} on a sidewalk sign. Add a bounce-back offer for the following weekday.", "why": f"{event['name']} · {event['distance']} · {summary['best_day']} is already your strongest day", "signals": ["event", "sales"], "impact": "High upside"},
        {"id": "weather-plan", "priority": "Plan ahead", "icon": "rain", "title": f"Build a {rainiest['day']} rain plan now", "action": f"Schedule a morning loyalty offer the night before and move your most comforting, high-margin products to the front. Staff lightly after the rush if foot traffic softens.", "why": f"{rainiest['rain']}% rain chance on {rainiest['day']} · {summary['lowest_day']} is your softest sales day", "signals": ["weather", "sales"], "impact": "Protects demand"},
        {"id": "sales-momentum", "priority": "This week", "icon": "spark", "title": f"{trend_action} with one measurable offer", "action": f"Run one two-hour offer tied to your goal: “{profile['goal']}.” Track it as a separate item so next week’s briefing can tell you if it earned a repeat.", "why": f"Recent sales are {direction} {abs(summary['trend_percent'])}% · daily average is ${summary['average']:,}", "signals": ["sales"], "impact": "Easy to measure"},
    ]


def claude_recommendations(profile: dict[str, Any], summary: dict[str, Any], weather: dict[str, Any], events: list[dict[str, Any]]) -> list[dict[str, Any]] | None:
    api_key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        return None
    context = {"business": {key: profile[key] for key in ("name", "type", "location", "goal")}, "sales_summary": summary, "last_14_sales": profile["sales"][-14:], "weather": weather, "events": events}
    prompt = """You are Sidekick, a warm and commercially sharp co-pilot for one small business owner. Analyze the supplied sales × weather × local events context. Return ONLY a JSON object with a `recommendations` array of exactly 3 objects. Each object must have: id (slug), priority (2-4 words), icon (event, rain, or spark), title (under 11 words), action (1-2 concrete sentences with timing/quantity/offer when justified), why (one sentence naming the exact signals), signals (array chosen from sales/weather/event), impact (2-4 words). Avoid generic advice and never invent facts beyond the context. Phrase plans as suggestions, not certainties.\n\nCONTEXT:\n""" + json.dumps(context, separators=(",", ":"))
    payload = {"model": os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-4-20250514"), "max_tokens": 1200, "temperature": 0.3, "messages": [{"role": "user", "content": prompt}]}
    try:
        response = post_json("https://api.anthropic.com/v1/messages", payload, headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"})
        text = "".join(block.get("text", "") for block in response.get("content", []) if block.get("type") == "text")
        match = re.search(r"\{.*\}", text, re.DOTALL)
        parsed = json.loads(match.group(0) if match else text)
        recommendations = parsed.get("recommendations", [])
        if len(recommendations) == 3 and all(isinstance(item, dict) for item in recommendations):
            return recommendations
    except (HTTPError, URLError, TimeoutError, ValueError, KeyError, json.JSONDecodeError) as exc:
        print(f"[sidekick] Claude unavailable; using local advisor: {exc}")
    return None


def create_briefing(payload: dict[str, Any]) -> dict[str, Any]:
    profile = clean_profile(payload)
    summary = summarize_sales(profile["sales"])
    live_weather = True
    try:
        place = geocode(profile["location"])
        weather = weather_for(place)
    except (HTTPError, URLError, TimeoutError, ValueError, KeyError) as exc:
        print(f"[sidekick] Live weather unavailable; using demo weather: {exc}")
        place = {"city": profile["location"].split(",")[0], "country_code": "US", "latitude": 45.52, "longitude": -122.68}
        weather, live_weather = fallback_weather(), False
    events, events_source = discover_events(place)
    recommendations = claude_recommendations(profile, summary, weather, events)
    advisor_mode = "claude" if recommendations else "demo"
    recommendations = recommendations or fallback_recommendations(profile, summary, weather, events)
    generated_at = datetime.now(timezone.utc).isoformat()
    result = {
        "generated_at": generated_at, "live_weather": live_weather, "location": place,
        "weather": weather, "events": events, "events_source": events_source,
        "sales": profile["sales"], "sales_summary": summary,
        "recommendations": recommendations, "advisor_mode": advisor_mode,
    }
    with sqlite3.connect(DB_PATH) as connection:
        connection.execute("INSERT OR REPLACE INTO profiles(name, payload, updated_at) VALUES (?, ?, ?)", (profile["name"], json.dumps(profile), generated_at))
        connection.execute("INSERT INTO briefings(profile_name, generated_at, advisor_mode, recommendations) VALUES (?, ?, ?, ?)", (profile["name"], generated_at, advisor_mode, json.dumps(recommendations)))
    return result


def briefing_history(profile_name: str) -> list[dict[str, Any]]:
    with sqlite3.connect(DB_PATH) as connection:
        rows = connection.execute("SELECT generated_at, advisor_mode, recommendations FROM briefings WHERE profile_name = ? ORDER BY id DESC LIMIT 20", (profile_name,)).fetchall()
    return [{"generated_at": generated, "advisor_mode": mode, "recommendations": json.loads(recommendations)} for generated, mode, recommendations in rows]


class SidekickHandler(BaseHTTPRequestHandler):
    server_version = "SidekickAI/1.0"

    def do_GET(self) -> None:  # noqa: N802
        parsed = urlparse(self.path)
        if parsed.path == "/api/health":
            self.send_json(200, {"status": "ok", "service": "sidekick", "version": "1.0"})
        elif parsed.path == "/api/history":
            business = parse_qs(parsed.query).get("business", [""])[0][:120]
            self.send_json(200, {"history": briefing_history(business)})
        else:
            self.serve_frontend(parsed.path)

    def do_POST(self) -> None:  # noqa: N802
        if urlparse(self.path).path != "/api/briefing":
            self.send_json(404, {"error": "Not found"})
            return
        try:
            length = min(int(self.headers.get("Content-Length", "0")), 2_000_000)
            payload = json.loads(self.rfile.read(length) or b"{}")
            self.send_json(200, create_briefing(payload))
        except (ValueError, json.JSONDecodeError) as exc:
            self.send_json(400, {"error": str(exc)})
        except Exception as exc:  # keep demo server responsive and surface useful error
            print(f"[sidekick] Unhandled briefing error: {exc}")
            self.send_json(500, {"error": "Sidekick hit a temporary problem. Please refresh the briefing."})

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204); self.send_cors_headers(); self.end_headers()

    def send_cors_headers(self) -> None:
        origin = self.headers.get("Origin", "")
        if origin in {"http://localhost:5173", "http://127.0.0.1:5173"}:
            self.send_header("Access-Control-Allow-Origin", origin)
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

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
