# Mobile Resource Placeholders

This folder tracks required native icon/splash assets for Capacitor projects.

## iOS placeholders
Place these in the Xcode asset catalog (`mobile/ios/App/App/Assets.xcassets`):
- App Store icon: `1024x1024` (no alpha)
- App icon set: `20, 29, 40, 60, 76, 83.5` point variants @1x/@2x/@3x
- Launch/Splash storyboard background + brand mark

## Android placeholders
Place these in Android resources (`mobile/android/app/src/main/res`):
- Adaptive icon foreground/background (`mipmap-anydpi-v26`)
- Legacy launcher icons in `mipmap-` density folders
- Splash image / drawable fallback assets

## Source baseline
Use `docs/icon-512.png` as source art and generate target sizes with:
```bash
bash scripts/generate-store-assets.sh
```
