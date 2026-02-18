from __future__ import annotations

import argparse
import json
import shutil
import subprocess
from datetime import datetime
from pathlib import Path

from .config import ensure_structure, vault_root
from .versioning import next_version


def _slug(text: str) -> str:
    out = "".join(ch.lower() if ch.isalnum() else "-" for ch in text.strip())
    while "--" in out:
        out = out.replace("--", "-")
    return out.strip("-") or "untitled"


def _render_md(
    title: str,
    project_code: str,
    tier: str,
    tags: list[str],
    source_notes: str,
    content: str,
    version: str,
) -> str:
    now = datetime.utcnow().isoformat() + "Z"
    return f"""# {title}

## Executive Summary
- Captured: {now}
- Project: {project_code}
- Tier: {tier}

## Core Analysis
{content or "(No content provided)"}

## Counterpoints & Risks
- Add disconfirming signals.

## Operational Implications
- Add concrete actions.

## Citations / Anchors
{source_notes or "N/A"}

## ARCHAIOS Tagging Index
- Project: {project_code}
- Version: {version}
- Tier: {tier}
- Date: {now}
- Tags: {", ".join(tags) if tags else "none"}
"""


def _maybe_pdf(md_path: Path, pdf_path: Path) -> tuple[bool, str]:
    pandoc = shutil.which("pandoc")
    if pandoc:
        proc = subprocess.run([pandoc, str(md_path), "-o", str(pdf_path)], capture_output=True, text=True)
        if proc.returncode == 0:
            return True, "pandoc"
    wk = shutil.which("wkhtmltopdf")
    if wk:
        proc = subprocess.run([wk, str(md_path), str(pdf_path)], capture_output=True, text=True)
        if proc.returncode == 0:
            return True, "wkhtmltopdf"
    return False, "none"


def archaios_init(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--vault-root", default=None)
    ns = ap.parse_args(argv)
    root = vault_root(ns.vault_root)
    ensure_structure(root)
    index = root / "INDEX_MASTER_LOG.md"
    if not index.exists():
        index.write_text("# ARCHAIOS Master Log\n", encoding="utf-8")
    print(f"Initialized: {root}")
    return 0


def archaios_capture(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--vault-root", default=None)
    ap.add_argument("--title", required=True)
    ap.add_argument("--project_code", default="")
    ap.add_argument("--tier", required=True, choices=["Research", "Doctrine", "Operational"])
    ap.add_argument("--tags", default="")
    ap.add_argument("--source_notes", default="")
    ap.add_argument("--content", default="")
    ap.add_argument("--input_file", default=None)
    ns = ap.parse_args(argv)

    root = vault_root(ns.vault_root)
    dirs = ensure_structure(root)
    active = dirs["01_ACTIVE_RESEARCH"]
    meta_dir = dirs["metadata"]
    archive_root = dirs["05_ARCHIVED_VERSIONS"]

    content = ns.content
    if ns.input_file:
        content = Path(ns.input_file).expanduser().read_text(encoding="utf-8")

    tags = [x.strip() for x in ns.tags.split(",") if x.strip()]
    slug = _slug(ns.title)
    ver = next_version(active, slug)
    v = ver.label()
    stem = f"{slug}_{v}"

    old = list(active.glob(f"{slug}_v*.md")) + list(active.glob(f"{slug}_v*.pdf")) + list(meta_dir.glob(f"{slug}_v*.json"))
    if old:
        ad = archive_root / slug
        ad.mkdir(parents=True, exist_ok=True)
        for p in old:
            shutil.move(str(p), str(ad / p.name))

    md_path = active / f"{stem}.md"
    pdf_path = active / f"{stem}.pdf"
    json_path = meta_dir / f"{stem}.json"

    md_path.write_text(_render_md(ns.title, ns.project_code, ns.tier, tags, ns.source_notes, content, v), encoding="utf-8")
    ok_pdf, engine = _maybe_pdf(md_path, pdf_path)
    if not ok_pdf and pdf_path.exists():
        pdf_path.unlink(missing_ok=True)

    rec = {
        "title": ns.title,
        "project_code": ns.project_code,
        "tier": ns.tier,
        "tags": tags,
        "version": v,
        "created_at": datetime.utcnow().isoformat() + "Z",
        "markdown_path": str(md_path),
        "pdf_path": str(pdf_path) if ok_pdf else None,
        "pdf_engine": engine,
        "metadata_path": str(json_path),
    }
    json_path.write_text(json.dumps(rec, indent=2), encoding="utf-8")

    idx = root / "INDEX_MASTER_LOG.md"
    if not idx.exists():
        idx.write_text("# ARCHAIOS Master Log\n", encoding="utf-8")
    with idx.open("a", encoding="utf-8") as f:
        f.write(
            f"- {datetime.utcnow().date()} | {ns.title} | {v} | {ns.tier} | {','.join(tags)} | {md_path} | {pdf_path if ok_pdf else '(no-pdf)'} | {json_path}\n"
        )

    print(str(md_path))
    print(str(json_path))
    if ok_pdf:
        print(str(pdf_path))
    else:
        print("PDF not generated (install pandoc or wkhtmltopdf)")
    return 0


def main_capture() -> None:
    raise SystemExit(archaios_capture())


def main_init() -> None:
    raise SystemExit(archaios_init())
