#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/docs/icon-512.png"
OUT="$ROOT/store-assets/icons/generated"
mkdir -p "$OUT"

if ! command -v sips >/dev/null 2>&1; then
  echo "sips not found (macOS tool). Install ImageMagick on non-macOS systems."
  exit 1
fi

for size in 1024 512 256 192 180 144 128 96 72 64 48 32; do
  sips -z "$size" "$size" "$SRC" --out "$OUT/icon-${size}.png" >/dev/null
  echo "Generated $OUT/icon-${size}.png"
done

echo "Done. Use generated icons to populate iOS/Android asset catalogs."
