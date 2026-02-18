from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

_RE = re.compile(r"_v(?P<major>\d+)\.(?P<minor>\d+)")


@dataclass(order=True, frozen=True)
class Version:
    major: int
    minor: int

    def label(self) -> str:
        return f"v{self.major}.{self.minor}"


def parse_version(name: str) -> Version | None:
    m = _RE.search(name)
    if not m:
        return None
    return Version(int(m.group("major")), int(m.group("minor")))


def next_version(active_dir: Path, slug: str) -> Version:
    versions: list[Version] = []
    for p in active_dir.glob(f"{slug}_v*.md"):
        v = parse_version(p.name)
        if v:
            versions.append(v)
    if not versions:
        return Version(1, 0)
    cur = sorted(versions)[-1]
    return Version(cur.major, cur.minor + 1)
