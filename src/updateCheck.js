// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// updateCheck.js — check for a newer version available (3.36.2).

import { Capacitor } from "@capacitor/core";
import { CURRENT_VERSION, isNewerVersion } from "./appVersionCheck";

const CHECKED_KEY = "seen_update_checked_at";
const CHECK_INTERVAL = 24 * 60 * 60 * 1000; // once per day

// Fetch the latest version from the app's public version file.
async function fetchLatestVersion() {
  try {
    const r = await fetch("/version.json", { cache: "no-store" });
    if (!r.ok) return null;
    const data = await r.json();
    return data?.version || null;
  } catch {
    return null;
  }
}

// Check if an update is available. Returns { available: bool, version: string } or null.
export async function checkForUpdate() {
  const now = Date.now();
  let lastChecked = 0;
  try {
    lastChecked = parseInt(localStorage.getItem(CHECKED_KEY) || "0", 10);
  } catch {
    /* private mode */
  }

  // Don't check more than once per day.
  if (now - lastChecked < CHECK_INTERVAL) return null;

  const latest = await fetchLatestVersion();
  try {
    localStorage.setItem(CHECKED_KEY, String(now));
  } catch {
    /* private mode */
  }

  if (!latest) return null;
  const available = isNewerVersion(CURRENT_VERSION, latest);
  return { available, version: latest };
}

// Open the app store / play store to update. Platform-aware.
export async function openAppStore() {
  const platform = Capacitor.getPlatform();
  // Replace these with the real app store links once available.
  const urls = {
    ios: "https://apps.apple.com/app/seen/idXXXXXXXXXX", // TODO: add real App Store ID
    android: "https://play.google.com/store/apps/details?id=com.seenapp.android",
  };
  const url = urls[platform] || urls.android;
  try {
    const { App } = await import("@capacitor/app");
    await App.openUrl({ url });
  } catch {
    // Fallback: open in browser if Capacitor App plugin fails.
    window.open(url, "_blank");
  }
}
