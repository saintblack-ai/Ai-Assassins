import tempfile
import unittest
from pathlib import Path

from ai_assassins_local.archaios.capture import archaios_init


class CliBootstrapTests(unittest.TestCase):
    def test_archaios_init_creates_vault_structure(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp) / "ARCHAIOS_VAULT"
            code = archaios_init(["--vault-root", str(root)])
            self.assertEqual(code, 0)

            expected = [
                "01_ACTIVE_RESEARCH",
                "02_DOCTRINE",
                "03_BOOK_MANUSCRIPTS",
                "04_QX_TECH",
                "05_ARCHIVED_VERSIONS",
                "metadata",
                "logs",
                "INDEX_MASTER_LOG.md",
            ]
            for name in expected:
                self.assertTrue((root / name).exists(), msg=f"missing: {name}")


if __name__ == "__main__":
    unittest.main()

