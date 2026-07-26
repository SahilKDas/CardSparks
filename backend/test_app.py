import json
import os
import tempfile
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError
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
        # MSYS Python can retain a Windows SQLite file handle for a moment after close.
        self.temp = tempfile.TemporaryDirectory(ignore_cleanup_errors=True)
        sidekick.DB_PATH = sidekick.Path(self.temp.name) / "test.db"
        self.server = sidekick.create_server(port=0)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.base = f"http://127.0.0.1:{self.server.server_port}"

    def tearDown(self) -> None:
        self.server.shutdown(); self.server.server_close(); self.temp.cleanup()

    def test_health(self) -> None:
        with urlopen(f"{self.base}/api/health") as response:
            self.assertEqual(response.status, 200)
            self.assertEqual(json.load(response)["status"], "ok")

    def test_sales_summary_finds_growth(self) -> None:
        summary = sidekick.summarize_sales(SALES)
        self.assertEqual(summary["trend_percent"], 38.5)
        self.assertEqual(summary["average"], 180)

    @patch("backend.app.claude_recommendations", return_value=None)
    @patch("backend.app.discover_events")
    @patch("backend.app.weather_for")
    @patch("backend.app.geocode")
    def test_briefing_end_to_end(self, mock_geocode, mock_weather, mock_events, _mock_claude) -> None:
        mock_geocode.return_value = {"latitude": 1, "longitude": 2, "city": "Portland", "country_code": "US", "live": True}
        mock_weather.return_value = sidekick.fallback_weather()
        mock_events.return_value = (sidekick.curated_demo_events("Portland"), "Curated demo events")
        request = Request(f"{self.base}/api/briefing", data=json.dumps(PROFILE).encode(), headers={"Content-Type": "application/json"}, method="POST")
        with urlopen(request) as response:
            data = json.load(response)
        self.assertEqual(response.status, 200)
        self.assertEqual(len(data["recommendations"]), 3)
        self.assertEqual(data["advisor_mode"], "demo")
        self.assertIn("Why", "Why this?")
        with urlopen(f"{self.base}/api/history?business=Test%20Coffee") as history_response:
            self.assertEqual(len(json.load(history_response)["history"]), 1)

    def test_invalid_profile_returns_400(self) -> None:
        request = Request(f"{self.base}/api/briefing", data=b"{}", headers={"Content-Type": "application/json"}, method="POST")
        with self.assertRaises(HTTPError) as context:
            urlopen(request)
        self.assertEqual(context.exception.code, 400)


if __name__ == "__main__":
    unittest.main()
