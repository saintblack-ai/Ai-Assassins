# AI Assassins — Daily Brief (PWA v9)

## Deploy (GitHub Pages)
1. Unzip this folder.
2. In your repo, **Upload files**: `index.html`, `manifest.webmanifest`, `integrations.js`, `sw.js`, the icons.
3. Settings → **Pages** → Source: `main` / Folder: `/(root)` → Save.
4. Open: `https://<your-user>.github.io/<your-repo>/` (example: `https://saintblack-ai.github.io/Ai-Assassins/`).
5. Safari → Share → **Add to Home Screen** → **AIA Brief**.

## Configure
- Settings → set **Calendar ICS URL**, **Agenda items**.
- Optional: set **lat,lon** (weather), **NewsAPI key** (headlines).
- Tap **Generate Brief**.

## Fixes in v9
- Hardened renderer: news links render as real anchors (no raw `<a>` text).
- All sections interactive; app-shell offline via service worker.
