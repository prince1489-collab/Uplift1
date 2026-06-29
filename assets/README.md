# App icon & splash sources (Capacitor)

These images are the **source** assets that `@capacitor/assets` expands into the full iOS
icon set + launch screen during the Codemagic build (`npx @capacitor/assets generate --ios`,
wired in `codemagic.yaml`). They write into `ios/App/App/Assets.xcassets`.

## Files
- `icon.png` — the app icon. **Should be 1024×1024** for crisp output. Currently seeded from
  `public/icon-512.png` (512×512) as a starting point — **replace it with a 1024×1024 master**
  (transparent or solid background, no rounded corners — Apple rounds it) for App-Store quality.
- `splash.png` *(optional, add later)* — 2732×2732, brand background with the logo centred.
- `splash-dark.png` *(optional)* — dark-mode variant.

## Regenerate
With the `ios/` project present (Codemagic creates it, or `npx cap add ios` on a Mac):

```
npx @capacitor/assets generate --ios
```

The Codemagic step runs this automatically and is non-fatal, so a missing/low-res source never
breaks the build — it just falls back to Capacitor's default icon until a 1024 master is dropped in.
