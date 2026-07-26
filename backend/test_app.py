import json
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

import backend.app as sidekick


SALES = [
    {"date": "2026-07-13", "amount": 100}, {"date": "2026-07-14", "amount": 110},
    {"date": "2026-07-15", "amount": 120}, {"date": "2026-07-16", "amount": 130},
    {"date": "2026-07-17", "amount": 140}, {"date": "2026-07-18", "amount": 150},
    {"date": "2026-07-19", "amount": 160}, {"date": "2026-07-20", "amount": 150},
    {"date": "2026-07-21", "amount": 160}, {"date": "2026-07-22", "amount": 170},
    {"date": "2026-07-23", "amount": 180}, {"date": "2026-07-24", "amount": 190},
    {"date": "2026-07-25", "amount": 200}, {"date": "2026-07-26", "amount": 210},
]
PROFILE = {"name": "Test Coffee", "type": "Coffee shop", "location": "Portland, OR", "goal": "Grow weekdays", "sales": SALES}


class SidekickTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        sidekick.DB_PATH = sidekick.Path(self.temp.name) / "test.db"
        sidekick.EVENT_CACHE.clear()
        self.server = sidekick.create_server(port=0)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.base = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self) -> None:
        self.server.shutdown(); self.server.server_close(); self.temp.cleanup()

    def api(self, path: str, method: str = "GET", payload: dict | None = None):
        data = json.dumps(payload).encode() if payload is not None else None
        request = Request(f"{self.base}{path}", data=data, headers={"Content-Type": "application/json"}, method=method)
        with urlopen(request) as response:
            return response.status, json.load(response)

    def local_advisor(self, profile, summary, weather, events, outcomes):
        return sidekick.fallback_recommendations(profile, summary, weather, events, outcomes), "local"

    def configure_signal_mocks(self, mock_geocode, mock_weather, mock_events, mock_advisor) -> None:
        mock_geocode.return_value = {"latitude": 1, "longitude": 2, "city": "Portland", "country_code": "US", "live": True}
        mock_weather.return_value = sidekick.fallback_weather()
        mock_events.return_value = (sidekick.curated_demo_events("Portland"), "Curated demo events")
        mock_advisor.side_effect = self.local_advisor

    def test_health(self) -> None:
        status, data = self.api("/api/health")
        self.assertEqual(status, 200)
        self.assertEqual(data["status"], "ok")
        self.assertEqual(data["version"], "2.0")

    def test_sales_summary_finds_growth(self) -> None:
        summary = sidekick.summarize_sales(SALES)
        self.assertEqual(summary["trend_percent"], 38.5)
        self.assertEqual(summary["average"], 180)

    @patch("backend.app.advisor_recommendations")
    @patch("backend.app.discover_events")
    @patch("backend.app.weather_for")
    @patch("backend.app.geocode")
    def test_briefing_end_to_end(self, mock_geocode, mock_weather, mock_events, mock_advisor) -> None:
        self.configure_signal_mocks(mock_geocode, mock_weather, mock_events, mock_advisor)
        status, data = self.api("/api/briefing", "POST", PROFILE)
        self.assertEqual(status, 200)
        self.assertEqual(len(data["recommendations"]), 3)
        self.assertEqual(data["advisor_mode"], "local")
        self.assertTrue(all(len(item["evidence"]) >= 2 for item in data["recommendations"]))
        self.assertTrue(all(item["success_metric"] for item in data["recommendations"]))
        _, history = self.api("/api/history?business=Test%20Coffee")
        self.assertEqual(len(history["history"]), 1)

    def test_action_lifecycle_measures_lift_and_teaches_advisor(self) -> None:
        sidekick.store().save_profile(PROFILE)
        recommendation = sidekick.fallback_recommendations(PROFILE, sidekick.summarize_sales(SALES), sidekick.fallback_weather(), sidekick.curated_demo_events("Portland"), [])[1]
        status, action = self.api("/api/actions", "POST", {"profile_name": PROFILE["name"], "recommendation": recommendation, "scheduled_for": "2026-07-20"})
        self.assertEqual(status, 201)
        self.assertEqual(action["status"], "planned")
        _, completed = self.api(f"/api/actions/{action['id']}", "PATCH", {"status": "completed"})
        self.assertEqual(completed["status"], "completed")
        _, measured = self.api(f"/api/actions/{action['id']}/outcome", "POST", {"observed_sales": 200, "helped": "yes", "note": "Morning offer worked."})
        self.assertEqual(measured["outcome"]["baseline_sales"], 125)
        self.assertEqual(measured["outcome"]["lift_amount"], 75)
        _, result = self.api("/api/actions?business=Test%20Coffee")
        self.assertEqual(len(result["actions"]), 1)
        learned = sidekick.fallback_recommendations(PROFILE, sidekick.summarize_sales(SALES), sidekick.fallback_weather(), sidekick.curated_demo_events("Portland"), result["actions"])
        self.assertIn("$75", learned[2]["title"])

    @patch("backend.app.advisor_recommendations")
    @patch("backend.app.discover_events")
    @patch("backend.app.weather_for")
    @patch("backend.app.geocode")
    def test_demo_reset_is_idempotent_and_contains_a_win(self, mock_geocode, mock_weather, mock_events, mock_advisor) -> None:
        self.configure_signal_mocks(mock_geocode, mock_weather, mock_events, mock_advisor)
        first = sidekick.reset_demo_story()
        second = sidekick.reset_demo_story()
        actions = sidekick.store().list_actions("Juniper Coffee Co.")
        self.assertEqual(len(actions), 1)
        self.assertEqual(actions[0]["outcome"]["lift_amount"], 210)
        self.assertTrue(first["demo_data"] and second["demo_data"])
        self.assertEqual(second["briefing"]["learning_count"], 1)
        self.assertIn("$210", second["briefing"]["recommendations"][2]["title"])

    def test_provider_output_is_normalized_to_shared_schema(self) -> None:
        raw = [{"title": f"Move {i}", "action": "Do one concrete thing.", "why": "Sales changed.", "signals": ["sales"]} for i in range(3)]
        result = sidekick.normalize_recommendations(raw, ["Sales trend +4%", "Daily average $900"])
        self.assertEqual(len(result), 3)
        self.assertTrue(all(len(item["evidence"]) == 2 for item in result))
        self.assertTrue(all(item["confidence"] == "medium" for item in result))

    @patch("backend.app.gemini_recommendations")
    @patch("backend.app.anthropic_recommendations", return_value=None)
    def test_auto_provider_falls_through_to_free_gemini(self, _anthropic, gemini) -> None:
        raw = [{"title": f"Move {i}", "action": "Do one concrete thing.", "why": "Sales and weather shifted.", "signals": ["sales", "weather"], "evidence": ["Sales trend +4%", "Rain chance 60%"]} for i in range(3)]
        gemini.return_value = raw
        with patch.dict(sidekick.os.environ, {"AI_PROVIDER": "auto"}, clear=False):
            items, provider = sidekick.advisor_recommendations(PROFILE, sidekick.summarize_sales(SALES), sidekick.fallback_weather(), sidekick.curated_demo_events("Portland"), [])
        self.assertEqual(provider, "gemini")
        self.assertEqual(len(items), 3)
        gemini.assert_called_once()

    @patch("backend.app.advisor_recommendations")
    @patch("backend.app.discover_events")
    @patch("backend.app.geocode", side_effect=URLError("offline"))
    def test_partial_outage_stays_actionable_and_labeled(self, _geocode, mock_events, mock_advisor) -> None:
        mock_events.return_value = (sidekick.curated_demo_events("Portland"), "Curated demo events")
        mock_advisor.side_effect = self.local_advisor
        _, result = self.api("/api/briefing", "POST", PROFILE)
        self.assertFalse(result["live_weather"])
        self.assertIn("demo", result["events_source"].lower())
        self.assertEqual(len(result["recommendations"]), 3)

    @patch("backend.app.discover_events")
    @patch("backend.app.geocode")
    def test_explicit_offline_mode_skips_external_signals(self, geocode, discover_events) -> None:
        with patch.dict(sidekick.os.environ, {"SIDEKICK_OFFLINE": "1"}, clear=False):
            _, result = self.api("/api/briefing", "POST", PROFILE)
        geocode.assert_not_called()
        discover_events.assert_not_called()
        self.assertFalse(result["live_weather"])
        self.assertEqual(result["advisor_mode"], "local")
        self.assertIn("offline recording mode", result["events_source"])

    @patch("backend.app.holiday_events", return_value=[])
    @patch("backend.app.ticketmaster_events")
    def test_event_results_are_cached(self, ticketmaster, _holidays) -> None:
        ticketmaster.return_value = [{"name": "Live show", "date": "Fri, Jul 31", "time": "7 PM", "distance": "1 mi", "category": "Music", "opportunity": "high"}]
        place = {"latitude": 45.52, "longitude": -122.68, "city": "Portland", "country_code": "US"}
        first = sidekick.discover_events(place)
        second = sidekick.discover_events(place)
        self.assertEqual(first[0], second[0])
        self.assertIn("cached", second[1])
        ticketmaster.assert_called_once()

    def test_invalid_profile_returns_400(self) -> None:
        request = Request(f"{self.base}/api/briefing", data=b"{}", headers={"Content-Type": "application/json"}, method="POST")
        with self.assertRaises(HTTPError) as context:
            urlopen(request)
        self.assertEqual(context.exception.code, 400)


if __name__ == "__main__":
    unittest.main()
