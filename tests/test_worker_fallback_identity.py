import unittest
from pathlib import Path


class WorkerFallbackIdentityTests(unittest.TestCase):
    def test_worker_identity_helper_present(self) -> None:
        identity_file = Path("worker/src/identity.ts")
        text = identity_file.read_text(encoding="utf-8")
        self.assertIn("resolveBriefUserId", text)
        self.assertIn("`device:${deviceHeader}`", text)
        self.assertIn("`device:${bodyDeviceId}`", text)

    def test_worker_brief_route_uses_identity_fallback(self) -> None:
        index_file = Path("worker/src/index.ts")
        text = index_file.read_text(encoding="utf-8")
        self.assertIn('url.pathname === "/api/brief" && request.method === "POST"', text)
        self.assertIn("resolveBriefUserId({", text)
        self.assertIn('request.headers.get("X-Device-Id")', text)
        self.assertIn("if (!userId) return blocked(401, env);", text)


if __name__ == "__main__":
    unittest.main()
