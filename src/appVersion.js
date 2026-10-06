// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// appVersion.js — is a newer Seen in the store than the one on this phone?
//
// The stores update most phones on their own, but not all (auto-update off), and nobody is ever
// told. So the native apps compare their own version with meta/appVersion — one small document,
// admin-written (firestore.rules meta/{docId}), set after each release with
// scripts/set-app-version.mjs:
//
//   { latest: "3.8", minimum: "3.4", iosUrl: "https://apps.apple.com/app/id…", androidUrl: "…" }
//
// Older than `latest` → a dismissible "new version" line, once per version. Older than `minimum`
// → the same line, not dismissible. Never a block. The web app is always current, so it never asks.

import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { Capacitor } from "@capacitor/core";

export function compareVersions(a, b) {
  const pa = String(a || "0").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = String(b || "0").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
}

const DISMISS_KEY = (v) => `seen_update_dismissed_${v}`;
const ANDROID_DEFAULT = "https://play.google.com/store/apps/details?id=app.seenapp.twa";
const IOS_DEFAULT = "https://apps.apple.com/search?term=Seen%20Kindness";

// Pure decision, so it can be tested: what (if anything) to show.
export function updateState({ current, latest, minimum, dismissed }) {
  if (!current || !latest) return null;
  if (compareVersions(current, latest) >= 0) return null;
  const required = Boolean(minimum) && compareVersions(current, minimum) < 0;
  if (!required && dismissed) return null;
  return { latest, required };
}

export function useUpdateAvailable(db) {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    let platform = "web";
    try { platform = Capacitor.getPlatform(); } catch { /* ignore */ }
    if (platform === "web" || !db) return undefined;
    let alive = true;
    (async () => {
      try {
        const [{ App }, snap] = await Promise.all([import("@capacitor/app"), getDoc(doc(db, "meta", "appVersion"))]);
        if (!alive || !snap.exists()) return;
        const meta = snap.data() || {};
        const { version } = await App.getInfo();
        let dismissed = false;
        try { dismissed = localStorage.getItem(DISMISS_KEY(meta.latest)) === "1"; } catch { /* ignore */ }
        const state = updateState({ current: version, latest: meta.latest, minimum: meta.minimum, dismissed });
        if (!alive || !state) return;
        const url = platform === "ios" ? (meta.iosUrl || IOS_DEFAULT) : (meta.androidUrl || ANDROID_DEFAULT);
        setInfo({ ...state, current: version, url });
      } catch { /* a version check must never get in the way */ }
    })();
    return () => { alive = false; };
  }, [db]);
  const dismiss = () => {
    if (!info || info.required) return;
    try { localStorage.setItem(DISMISS_KEY(info.latest), "1"); } catch { /* ignore */ }
    setInfo(null);
  };
  return { update: info, dismiss };
}

// The version installed on this phone ("3.11"), for the menu footer. null on the web, where
// the build hash alone says which deploy is running.
export function useInstalledVersion() {
  const [version, setVersion] = useState(null);
  useEffect(() => {
    let platform = "web";
    try { platform = Capacitor.getPlatform(); } catch { /* ignore */ }
    if (platform === "web") return undefined;
    let alive = true;
    import("@capacitor/app")
      .then(({ App }) => App.getInfo())
      .then((info) => { if (alive && info?.version) setVersion(info.version); })
      .catch(() => {});
    return () => { alive = false; };
  }, []);
  return version;
}
