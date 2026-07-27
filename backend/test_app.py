import json
import sqlite3
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

    def create_planned_action(self):
        sidekick.store().save_profile(PROFILE)
        recommendation = sidekick.fallback_recommendations(
            PROFILE, sidekick.summarize_sales(SALES), sidekick.fallback_weather(),
            sidekick.curated_demo_events("Portland"), [],
        )[0]
        return sidekick.store().create_action({
            "profile_name": PROFILE["name"], "recommendation": recommendation,
            "scheduled_for": "2026-07-20",
        })

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
        event_move = next(item for item in data["recommendations"] if "event" in item["signals"])
        self.assertEqual(event_move["scheduled_for"], data["events"][0]["iso_date"])
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
        _, measured = self.api(f"/api/actions/{action['id']}/outcome", "POST", {"observed_sales": 200, "helped": "yes", "redemptions": 12, "note": "Morning offer worked."})
        self.assertEqual(measured["outcome"]["baseline_sales"], 125)
        self.assertEqual(measured["outcome"]["lift_amount"], 75)
        self.assertEqual(measured["outcome"]["redemptions"], 12)
        _, result = self.api("/api/actions?business=Test%20Coffee")
        self.assertEqual(len(result["actions"]), 1)
        learned = sidekick.fallback_recommendations(PROFILE, sidekick.summarize_sales(SALES), sidekick.fallback_weather(), sidekick.curated_demo_events("Portland"), result["actions"])
        self.assertIn("$75", learned[2]["title"])
        self.assertIn("Campaign code redemptions: 12", learned[2]["evidence"])

    @patch("backend.app.advisor_recommendations")
    @patch("backend.app.discover_events")
    @patch("backend.app.weather_for")
    @patch("backend.app.geocode")
    def test_demo_reset_is_idempotent_and_contains_a_win(self, mock_geocode, mock_weather, mock_events, mock_advisor) -> None:
        self.configure_signal_mocks(mock_geocode, mock_weather, mock_events, mock_advisor)
        first = sidekick.reset_demo_story()
        old_action_id = first["seeded_action"]["id"]
        with patch.dict(sidekick.os.environ, {"SIDEKICK_OFFLINE": "1"}, clear=False):
            sidekick.generate_launch_kit(old_action_id)
        second = sidekick.reset_demo_story()
        actions = sidekick.store().list_actions("Juniper Coffee Co.")
        self.assertEqual(len(actions), 1)
        self.assertEqual(actions[0]["outcome"]["lift_amount"], 210)
        self.assertFalse(actions[0]["has_launch_kit"])
        with self.assertRaises(ValueError):
            sidekick.store().get_launch_kit(old_action_id)
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

    def test_launch_kit_local_schema_is_complete_and_grounded(self) -> None:
        action = self.create_planned_action()
        with patch.dict(sidekick.os.environ, {"SIDEKICK_OFFLINE": "1"}, clear=False):
            status, kit = self.api(f"/api/actions/{action['id']}/launch-kit", "POST", {})
        self.assertEqual(status, 200)
        self.assertEqual(kit["provider"], "local")
        self.assertEqual(kit["offer_name"], "Festival Fuel")
        self.assertEqual(kit["action_id"], action["id"])
        self.assertLessEqual(len(kit["customer_copy"]["sms"]), 160)
        self.assertEqual(kit["campaign_code"], "FESTIVALFUEL")
        self.assertIn("FESTIVALFUEL", kit["customer_copy"]["social"])
        self.assertIn("FESTIVALFUEL", kit["customer_copy"]["sms"])
        self.assertIn("FESTIVALFUEL", kit["customer_copy"]["sign_body"])
        self.assertFalse(kit["owner_approved"])
        self.assertGreaterEqual(len(kit["operations"]), 2)
        self.assertEqual(kit["measurement"]["baseline_sales"], 125)
        _, listed = self.api("/api/actions?business=Test%20Coffee")
        self.assertTrue(listed["actions"][0]["has_launch_kit"])
        self.assertEqual(listed["actions"][0]["launch_kit"]["offer_name"], "Festival Fuel")

    def test_launch_kit_creation_is_idempotent_and_refresh_replaces_it(self) -> None:
        action = self.create_planned_action()
        with patch.dict(sidekick.os.environ, {"SIDEKICK_OFFLINE": "1"}, clear=False):
            _, first = self.api(f"/api/actions/{action['id']}/launch-kit", "POST", {})
            _, second = self.api(f"/api/actions/{action['id']}/launch-kit", "POST", {})
            _, refreshed = self.api(f"/api/actions/{action['id']}/launch-kit", "POST", {"refresh": True})
        self.assertEqual(first, second)
        self.assertNotEqual(first["generated_at"], refreshed["generated_at"])
        _, fetched = self.api(f"/api/actions/{action['id']}/launch-kit")
        self.assertEqual(fetched, refreshed)

    @patch("backend.app.gemini_launch_kit", return_value=None)
    @patch("backend.app.anthropic_launch_kit", return_value={"offer_name": "Incomplete"})
    def test_malformed_provider_kit_falls_back_safely(self, _anthropic, _gemini) -> None:
        action = self.create_planned_action()
        with patch.dict(sidekick.os.environ, {"AI_PROVIDER": "auto", "SIDEKICK_OFFLINE": "0"}, clear=False):
            kit = sidekick.generate_launch_kit(action["id"])
        self.assertEqual(kit["provider"], "local")
        self.assertTrue(kit["customer_copy"]["sign_headline"])

    @patch("backend.app.gemini_launch_kit")
    @patch("backend.app.anthropic_launch_kit")
    def test_provider_outputs_share_identical_normalized_shape(self, anthropic, gemini) -> None:
        action = self.create_planned_action()
        context = sidekick.launch_kit_context(action)
        raw = sidekick.local_launch_kit(context)
        anthropic.return_value = raw
        gemini.return_value = raw
        keys = set(sidekick.normalize_launch_kit(raw, action["id"], "local", context))
        for provider, implementation in (("anthropic", anthropic), ("gemini", gemini)):
            normalized = sidekick.normalize_launch_kit(implementation(context), action["id"], provider, context)
            self.assertEqual(set(normalized), keys)
            self.assertEqual(set(normalized["customer_copy"]), {"social", "sms", "sign_headline", "sign_body"})

    @patch("backend.app.gemini_launch_kit", return_value=None)
    @patch("backend.app.anthropic_launch_kit")
    def test_ungrounded_discount_is_rejected(self, anthropic, _gemini) -> None:
        action = self.create_planned_action()
        context = sidekick.launch_kit_context(action)
        unsafe = sidekick.local_launch_kit(context)
        unsafe["customer_copy"]["social"] = "Get a free pastry today"
        anthropic.return_value = unsafe
        with patch.dict(sidekick.os.environ, {"AI_PROVIDER": "auto", "SIDEKICK_OFFLINE": "0"}, clear=False):
            kit = sidekick.generate_launch_kit(action["id"])
        self.assertEqual(kit["provider"], "local")
        self.assertNotIn("free pastry", kit["customer_copy"]["social"].lower())

    @patch("backend.app.gemini_launch_kit")
    @patch("backend.app.anthropic_launch_kit")
    def test_offline_launch_kit_makes_no_provider_calls(self, anthropic, gemini) -> None:
        action = self.create_planned_action()
        with patch.dict(sidekick.os.environ, {"SIDEKICK_OFFLINE": "1"}, clear=False):
            kit = sidekick.generate_launch_kit(action["id"])
        anthropic.assert_not_called()
        gemini.assert_not_called()
        self.assertEqual(kit["provider"], "local")

    def test_missing_launch_kit_action_returns_safe_errors(self) -> None:
        for path, method, payload, expected in (
            ("/api/actions/9999/launch-kit", "GET", None, 404),
            ("/api/actions/9999/launch-kit", "POST", {}, 400),
        ):
            with self.assertRaises(HTTPError) as context:
                self.api(path, method, payload)
            self.assertEqual(context.exception.code, expected)

    def test_owner_can_edit_and_approve_launch_kit(self) -> None:
        action = self.create_planned_action()
        with patch.dict(sidekick.os.environ, {"SIDEKICK_OFFLINE": "1"}, clear=False):
            _, kit = self.api(f"/api/actions/{action['id']}/launch-kit", "POST", {})
        edited = {
            **kit,
            "campaign_code": "MARKET22",
            "schedule": {**kit["schedule"], "time": "16:15"},
            "customer_copy": {**kit["customer_copy"], "social": "A neighbor-made market stop.", "sms": "See you before the market."},
            "operations": [
                {"task": "Prepare the featured products", "timing": "Morning", "owner": "Sam"},
                {"task": "Place the sidewalk sign", "timing": "Before launch", "owner": "Alex"},
            ],
        }
        _, approved = self.api(f"/api/actions/{action['id']}/launch-kit", "PATCH", {"launch_kit": edited, "owner_approved": True})
        self.assertTrue(approved["owner_approved"])
        self.assertTrue(approved["approved_at"])
        self.assertEqual(approved["campaign_code"], "MARKET22")
        self.assertEqual(approved["schedule"]["time"], "16:15")
        self.assertIn("MARKET22", approved["customer_copy"]["social"])
        self.assertIn("MARKET22", approved["customer_copy"]["sms"])
        self.assertEqual(approved["operations"][0]["owner"], "Sam")
        _, listed = self.api("/api/actions?business=Test%20Coffee")
        self.assertTrue(listed["actions"][0]["launch_kit"]["owner_approved"])

    def test_invalid_redemptions_are_rejected(self) -> None:
        action = self.create_planned_action()
        with self.assertRaises(HTTPError) as context:
            self.api(f"/api/actions/{action['id']}/outcome", "POST", {"observed_sales": 200, "helped": "yes", "redemptions": -1})
        self.assertEqual(context.exception.code, 400)

    def test_existing_outcomes_table_is_migrated_additively(self) -> None:
        legacy_path = sidekick.Path(self.temp.name) / "legacy.db"
        with sqlite3.connect(legacy_path) as connection:
            connection.execute("""CREATE TABLE outcomes (
                id INTEGER PRIMARY KEY AUTOINCREMENT, action_id INTEGER NOT NULL UNIQUE,
                observed_sales REAL NOT NULL, baseline_sales REAL NOT NULL,
                lift_amount REAL NOT NULL, lift_percent REAL NOT NULL,
                helped TEXT NOT NULL, note TEXT NOT NULL, created_at TEXT NOT NULL
            )""")
        legacy_store = sidekick.SidekickStore(legacy_path)
        legacy_store.init()
        with legacy_store.connect() as connection:
            columns = {row["name"] for row in connection.execute("PRAGMA table_info(outcomes)").fetchall()}
        self.assertIn("redemptions", columns)

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
