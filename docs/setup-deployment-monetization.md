# AI Assassins — Daily Brief: Setup, Deployment & Monetization Guide

**Version:** 1.0  
**Date:** October 10, 2025

---

## Overview of the App

AI Assassins — Daily Brief is a cross-platform news and insights application that delivers personalized daily briefings using AI. It is built as a Progressive Web App (PWA) and can be installed on mobile devices, providing an app-like experience. Core capabilities include:

- AI-curated daily news summaries.
- Offline access to recent briefs.
- Multi-platform availability (Web, iOS, Android).
- Responsive UI with installable PWA behavior.

Users can install the PWA or download the native app wrappers on iOS/Android (via Capacitor) for native features such as push notifications.

---

## Developer Setup Requirements (One-Time)

Ensure the following tools and accounts are available before developing, building, or publishing the app.

### Development Tools

- Node.js and npm (for running builds and tooling).
- Capacitor CLI (`npm install -g @capacitor/cli`).
- Code editor or IDE of choice (e.g., VS Code).
- Android Studio with the Android SDK.
- Xcode on macOS for iOS builds (requires macOS environment).

### Developer Accounts

- Apple Developer Program membership (required for iOS builds, certificates, provisioning profiles, TestFlight; $99/year).
- Google Play Developer Account (required for Play Store publishing; one-time $25 fee).
- Optional third-party service accounts (e.g., Firebase for push notifications).

> **Tip:** Keep Xcode and Android SDK up to date. Configure PATH variables as needed, and set up signing (Xcode can auto-manage for iOS; Android requires a release keystore when ready).

---

## Preparing the PWA (Manifest, Service Worker, CORS)

### Web App Manifest

Create `manifest.json` (or `.webmanifest`) in the web app’s public directory with metadata:

```json
{
  "name": "AI Assassins — Daily Brief",
  "short_name": "DailyBrief",
  "description": "AI-curated daily news briefings",
  "start_url": "/index.html",
  "display": "standalone",
  "theme_color": "#002244",
  "background_color": "#ffffff",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

Link it in `<head>`:

```html
<link rel="manifest" href="manifest.json" />
```

Serve with MIME type `application/manifest+json`. If resources are cross-origin or require credentials, add `crossorigin="use-credentials"` on the `<link>` tag.

### Service Worker

Add `sw.js` to enable offline caching:

```js
const CACHE_NAME = "daily-brief-cache-v1";
const ASSETS_TO_CACHE = ["/", "/index.html", "/app.js", "/styles.css"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE)));
});

self.addEventListener("fetch", event => {
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
```

Register it in your main JS/HTML file:

```html
<script>
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(err => console.error("SW registration failed", err));
  }
</script>
```

Customize caching strategies for dynamic data (e.g., network-first).

### CORS Considerations

- Always run a dev server (e.g., `npm start`, `npx serve`) instead of loading files via `file://`.
- Ensure APIs send appropriate `Access-Control-Allow-Origin` headers.
- Host manifest and service worker on the same domain when possible.
- Use HTTPS in production (required for service workers except on localhost).

---

## Capacitor Wrapping for iOS and Android

1. **Install Capacitor** in the project directory:

   ```bash
   npm init -y
   npm install @capacitor/core @capacitor/cli
   npx cap init
   ```

   Use app name `AI Assassins — Daily Brief` and ID `com.aiassassins.dailybrief`. Ensure `capacitor.config.json` points `webDir` to your build output (e.g., `build/`).

2. **Build web assets** (e.g., `npm run build`).
3. **Copy assets** into native projects: `npx cap copy` (or `npx cap sync`).
4. **Add platforms**:

   ```bash
   npx cap add android
   npx cap add ios
   ```

5. **Configure plugins** as needed (e.g., push notifications). Install via npm and run `npx cap sync`.

Open projects in native IDEs with `npx cap open android` / `npx cap open ios` for further configuration.

---

## Building & Publishing on iOS (App Store)

1. **Open Xcode project** (`npx cap open ios`). Set signing team, bundle ID, display name, and increment version/build numbers.
2. **Create App Store Connect record** with matching bundle ID.
3. **Provisioning**: Use automatic signing or manually manage certificates/profiles.
4. **Archive**: In Xcode, select *Any iOS Device* → *Product > Archive*.
5. **Upload**: From Organizer, choose *Distribute App > App Store Connect > Upload*.
6. **TestFlight**: Optionally enable internal/external beta testing.
7. **Metadata**: Complete listing details, privacy responses, and provide privacy policy URL.
8. **Submit for review**; once approved, release manually or automatically.

> Provide demo credentials in App Review notes if login is required.

---

## Building & Publishing on Android (Google Play)

1. **Open Android Studio** (`npx cap open android`). Verify `applicationId`, `versionCode`, and `versionName` in `android/app/build.gradle`. Ensure required permissions (e.g., `INTERNET`).
2. **Signing**: Generate keystore with `keytool` or let Google manage signing. Configure Gradle signing or upload key as needed.
3. **Build release bundle**:

   ```bash
   cd android
   ./gradlew bundleRelease
   ```

   Outputs `app-release.aab`.

4. **Play Console setup**: Create app listing, upload AAB to Internal Testing track, enroll in Play App Signing if prompted.
5. **Metadata & policies**: Complete store listing, Content Rating, Data Safety, and provide privacy policy.
6. **Testing**: Distribute internal/closed tests. Join via Play Store link.
7. **Production release**: Promote tested build to Production and submit for review.

Ensure target/compile SDK versions meet Google’s latest requirements (e.g., API level 34).

---

## CI/CD Setup (GitHub Actions)

Example workflow to build Android AAB and iOS IPA on pushes to `main`:

```yaml
name: Build Mobile Apps

on:
  push:
    branches: [ main ]

jobs:
  build-android:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-java@v3
        with:
          distribution: temurin
          java-version: "17"
      - uses: actions/cache@v3
        with:
          path: ~/.gradle/caches
          key: ${{ runner.os }}-gradle-${{ hashFiles('**/*.gradle*', '**/gradle-wrapper.properties') }}
      - name: Build Android Bundle
        working-directory: android
        run: ./gradlew clean bundleRelease
      - uses: actions/upload-artifact@v3
        with:
          name: app-release-bundle
          path: android/app/build/outputs/bundle/release/*.aab

  build-ios:
    runs-on: macos-latest
    needs: build-android
    steps:
      - uses: actions/checkout@v3
      - name: Install CocoaPods
        run: pod install --project-directory=ios/App
      - name: Build iOS Archive
        run: |
          xcodebuild -workspace ios/App/App.xcworkspace \
                     -scheme App \
                     -configuration Release \
                     -sdk iphoneos \
                     -archivePath ios/App.xcarchive \
                     archive
      - name: Export .ipa from Archive
        env:
          EXPORT_OPTIONS_PLIST: ${{ secrets.EXPORT_OPTIONS_PLIST }}
        run: |
          echo "$EXPORT_OPTIONS_PLIST" > ios/export-options.plist
          xcodebuild -exportArchive \
                     -archivePath ios/App.xcarchive \
                     -exportOptionsPlist ios/export-options.plist \
                     -exportPath ios/build
      - uses: actions/upload-artifact@v3
        with:
          name: app-ipa
          path: ios/build/*.ipa
```

Store signing credentials and secrets securely in GitHub. Extend with Fastlane or APIs to automate deployment to TestFlight or Play Store as needed.

---

## Asset Requirements

### Icons & Splash Screens

- Provide a 1024×1024 PNG source icon (no rounded corners, no transparency).
- Use `npx capacitor-assets generate` to create platform-specific icons and splash assets.
- App Store requires a 1024×1024 icon; Play Store requires 512×512 and a 1024×500 feature graphic.
- Configure splash screens for iOS (LaunchScreen storyboard) and Android (launch drawable). Ensure safe area margins.
- Manifest icons (192×192, 512×512) drive the PWA install icon and splash background.

### Screenshots

- **iOS**: 3–10 screenshots per device size (e.g., 6.5" iPhone at 1242×2688, 12.9" iPad at 2048×2732). Optional app preview video.
- **Android**: At least 4 phone screenshots (e.g., 1080×1920), plus optional tablet/Chromebook/feature graphics.
- Maintain source design files for future updates.

### Additional Assets

- Privacy policy URL, marketing/support URLs, and optional promo video or feature graphic.

---

## App Store Metadata Requirements

### Apple App Store

Provide:

- App Name, Subtitle, Description, Keywords.
- App Store icon (1024×1024 PNG, no alpha).
- Screenshots and optional preview video.
- Primary/secondary categories, age rating questionnaire.
- Privacy responses and policy URL.
- Support and marketing URLs.
- Copyright notice, version number, build association.
- Demo credentials for review (if login required).
- Export compliance answers (encryption usage).

### Google Play Store

Provide:

- App Title, Short Description, Full Description.
- High-res icon (512×512), Feature Graphic (1024×500), screenshots, optional promo video.
- Category and tags.
- Content Rating questionnaire, Data Safety form.
- Privacy policy URL, contact details (email required).
- Release notes for updates.
- Declarations for ads, IAPs, or permissions as applicable.

Ensure metadata complies with store policies to avoid review delays.

---

## Revenue Models Overview

- **Advertising**: Integrate display/native ads (e.g., via AdMob). Balance revenue with UX.
- **In-App Purchases**: Offer one-time premium unlocks (e.g., ad removal, advanced features).
- **Subscriptions**: Provide recurring access to Pro features (ad-free, personalization, archives). Major revenue driver for content apps.
- **Upfront Purchase**: Paid download; less common for news apps.
- **Enterprise/B2B Deals**: License tailored versions to organizations (private distribution).
- **Sponsorship/Affiliate**: Include sponsored segments or referral links with clear disclosure.

Freemium (free download + optional subscription/IAP) typically maximizes reach and revenue potential.

---

## Pricing Tiers: Free vs Pro vs Enterprise

| Tier       | Price                     | Features |
|------------|---------------------------|----------|
| Free       | $0 (ad-supported)         | Daily AI brief (standard topics), recent briefs (e.g., last 3 days), basic personalization (select up to 3 topics), ads, optional/basic sign-in. |
| Pro        | $5/month or $50/year      | All Free features, no ads, deeper personalization, archive access, customizable briefing schedule and notifications, multi-device sync, early access to new features. |
| Enterprise | Custom (contract-based)   | White-labeled/team app, admin portal for company news, enhanced security/SSO, dedicated support/SLAs, private distribution (Apple Business Manager / managed Play), integration with internal data feeds. |

Consider optional lifetime purchase or bundles based on market research.

---

## Future Roadmap (Advanced Features)

- **Push Notifications**: Reminders via Web Push, APNs, FCM; allow scheduling and opt-outs.
- **End-to-End Encryption**: Secure sensitive data, especially for enterprise clients.
- **Cloud Sync & Accounts**: Sync preferences/bookmarks across devices via backend services.
- **Offline Downloads**: Prefetch latest brief for offline reading.
- **AI Enhancements**: Interactive chatbot, text-to-speech brief playback, personalized summaries.
- **Social Sharing & Referrals**: Easy sharing, potential referral program.
- **User Analytics & Insights**: Provide personal usage stats (with consent).
- **Platform Features**: Consider widgets (iOS/Android), evolving PWA capabilities.

---

By following this guide, developers can configure the PWA, wrap it for native platforms, handle store submissions, establish CI/CD, monetize effectively, and plan for future enhancements. AI Assassins — Daily Brief can launch as a robust cross-platform product and evolve with a sustainable revenue strategy.

