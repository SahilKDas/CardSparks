import json
import threading
import unittest
from urllib.request import urlopen

from backend.app import create_server


class HealthTest(unittest.TestCase):
    def test_health(self) -> None:
        server = create_server(port=0)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        try:
            with urlopen(f"http://127.0.0.1:{server.server_port}/api/health") as response:
                self.assertEqual(response.status, 200)
                self.assertEqual(json.load(response)["status"], "ok")
        finally:
            server.shutdown()


if __name__ == "__main__":
    unittest.main()

