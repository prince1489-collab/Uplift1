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

// Authenticated POST to one of our /api routes. Lives here rather than in a component so
// every caller goes through apiUrl() — a relative fetch resolves to the local bundle in the
// Capacitor build and never reaches Vercel.
//
// Throws an Error carrying `.status` so callers can tell "the checker is down" (503, or a
// network failure with no status) from "you're not signed in" (401).
export async function authedPost(currentUser, path, body) {
  const token = await currentUser.getIdToken();
  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = new Error(`http ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}
