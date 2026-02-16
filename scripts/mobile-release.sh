#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "[1/4] Build web assets"
npm --prefix "$ROOT/docs" run build

echo "[2/4] Install mobile dependencies"
npm --prefix "$ROOT/mobile" install

echo "[3/4] Add native platforms (if missing) and sync"
if [ ! -d "$ROOT/mobile/ios" ]; then
  npm --prefix "$ROOT/mobile" run ios:add
fi
if [ ! -d "$ROOT/mobile/android" ]; then
  npm --prefix "$ROOT/mobile" run android:add
fi
npm --prefix "$ROOT/mobile" run sync

echo "[4/4] Prepare release artifacts"
if [ -d "$ROOT/mobile/android" ]; then
  (cd "$ROOT/mobile/android" && chmod +x gradlew && ./gradlew bundleRelease)
fi

if [ -d "$ROOT/mobile/ios/App/App.xcworkspace" ]; then
  xcodebuild \
    -workspace "$ROOT/mobile/ios/App/App.xcworkspace" \
    -scheme App \
    -configuration Release \
    -sdk iphoneos \
    -archivePath "$ROOT/mobile/ios/build/App.xcarchive" \
    archive
fi

echo "Done. Next: export .ipa in Xcode Organizer or via xcodebuild -exportArchive."
