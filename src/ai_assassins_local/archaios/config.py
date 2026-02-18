from __future__ import annotations

import os
from pathlib import Path


def vault_root(override: str | None = None) -> Path:
    raw = override or os.getenv("ARCHAIOS_VAULT_ROOT") or "~/ARCHAIOS_VAULT"
    return Path(raw).expanduser().resolve()


def ensure_structure(root: Path) -> dict[str, Path]:
    names = [
        "01_ACTIVE_RESEARCH",
        "02_DOCTRINE",
        "03_BOOK_MANUSCRIPTS",
        "04_QX_TECH",
        "05_ARCHIVED_VERSIONS",
        "metadata",
        "logs",
    ]
    out: dict[str, Path] = {}
    for name in names:
        p = root / name
        p.mkdir(parents=True, exist_ok=True)
        out[name] = p
    return out
