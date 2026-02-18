import tempfile
import unittest
from pathlib import Path

from ai_assassins_local.archaios.versioning import Version, next_version, parse_version


class VersioningTests(unittest.TestCase):
    def test_parse_version(self) -> None:
        self.assertEqual(parse_version("intel_v1.2.md"), Version(1, 2))
        self.assertIsNone(parse_version("intel.md"))

    def test_next_version_increments_patch(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            active = Path(tmp) / "01_ACTIVE_RESEARCH"
            active.mkdir(parents=True)
            (active / "intel_v1.0.md").write_text("x", encoding="utf-8")
            (active / "intel_v1.1.md").write_text("x", encoding="utf-8")
            self.assertEqual(next_version(active, "intel"), Version(1, 2))


if __name__ == "__main__":
    unittest.main()
