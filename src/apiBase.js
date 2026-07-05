// apiBase.js — resolve /api/* URLs correctly on every platform.
//
// The iOS app is a bundled Capacitor build (no server.url), so it loads from capacitor://localhost
// and a RELATIVE `fetch("/api/…")` resolves to the local bundle (404) — it never reaches the Vercel
// backend. On the web and the Android TWA the app runs on www.seenapp.app, so relative paths work.
// So: on a native platform, call the production origin directly; everywhere else keep it relative.
import { Capacitor } from "@capacitor/core";

const PROD_ORIGIN = "https://www.seenapp.app";

export function apiUrl(path) {
  try {
    if (Capacitor.getPlatform() !== "web") return `${PROD_ORIGIN}${path}`;
  } catch { /* Capacitor unavailable → treat as web */ }
  return path;
}
