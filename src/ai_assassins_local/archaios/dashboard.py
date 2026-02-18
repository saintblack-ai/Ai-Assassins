from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

from ai_assassins_local.archaios.config import ensure_structure, vault_root


def _render(vroot: Path) -> None:
    import streamlit as st

    st.set_page_config(page_title="ARCHAIOS Dashboard", layout="wide")
    st.title("ARCHAIOS Research Dashboard")
    st.caption(str(vroot))

    mdir = vroot / "metadata"
    entries = []
    for fp in sorted(mdir.glob("*_v*.json"), reverse=True):
        try:
            entries.append(json.loads(fp.read_text(encoding="utf-8")))
        except Exception:
            continue

    q = st.text_input("Search", "").strip().lower()
    tiers = ["All", "Research", "Doctrine", "Operational"]
    tier = st.selectbox("Tier", tiers)
    tags = sorted({t for e in entries for t in e.get("tags", [])})
    tag = st.selectbox("Tag", ["All"] + tags)

    def keep(e: dict) -> bool:
        blob = json.dumps(e).lower()
        if q and q not in blob:
            return False
        if tier != "All" and e.get("tier") != tier:
            return False
        if tag != "All" and tag not in e.get("tags", []):
            return False
        return True

    rows = [e for e in entries if keep(e)]
    rows.sort(key=lambda x: x.get("created_at", ""), reverse=True)

    st.write(f"Results: {len(rows)}")
    for i, e in enumerate(rows):
        with st.expander(f"{e.get('title','Untitled')} | {e.get('tier','Unknown')} | {e.get('version','?')}"):
            md = e.get("markdown_path")
            if md and Path(md).exists():
                st.markdown(Path(md).read_text(encoding="utf-8"))
            st.json(e)
            cols = st.columns(2)
            with cols[0]:
                if st.button("Open in Finder", key=f"open-{i}") and md:
                    subprocess.run(["open", "-R", md], check=False)
            with cols[1]:
                if md:
                    st.code(md)


def archaios_dashboard(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(add_help=False)
    ap.add_argument("--vault-root", default=None)
    ns, _ = ap.parse_known_args(argv)
    root = vault_root(ns.vault_root)
    ensure_structure(root)
    _render(root)
    return 0


def main() -> None:
    cmd = [sys.executable, "-m", "streamlit", "run", str(Path(__file__).resolve())]
    raise SystemExit(subprocess.call(cmd))


if __name__ == "__main__":
    archaios_dashboard(sys.argv[1:])
