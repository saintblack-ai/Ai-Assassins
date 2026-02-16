# AI Assassins Native Wrapper (Capacitor)

This folder wraps the existing PWA (`../docs`) into native iOS/Android apps.

## Quickstart
```bash
cd mobile
npm install
npm run ios:add
npm run android:add
npm run sync
```

## Build outputs
- Android AAB: `mobile/android/app/build/outputs/bundle/release/app-release.aab`
- iOS archive: `mobile/ios/build/App.xcarchive` (export to .ipa from Xcode Organizer)

## RevenueCat
Set RevenueCat API keys in native projects (Xcode/Android resources) and initialize in app startup hooks.
