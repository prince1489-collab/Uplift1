// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// rightNow.js — "Right now…" lines, wherever they're shown (3.18).
//
// The line you share from your conversation with Seen used to appear in exactly one place — the
// glimpse someone ELSE sees when they tap your name — so after sharing it you had no way to see
// where it went. Now it's visible where it lives: next to your name in the feed (yours and your
// followers'), in your own profile menu, and in a preview of your own glimpse.
//
// Your own line is watched live, so it appears the moment you share it; the lines of people you
// follow are read once per change in who you follow. Lines older than LINE_DAYS fade from the
// feed — "right now" shouldn't still be saying the same thing two months later.

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { readPublicProfile } from "./publicProfile";

export const LINE_DAYS = 30;
export const freshLine = (p, now = Date.now()) => {
  const t = String(p?.rightNow || "").trim();
  if (!t) return null;
  const at = Number(p?.rightNowAt || 0);
  return !at || now - at < LINE_DAYS * 86400000 ? t : null;
};

export function useMyRightNow(db, uid) {
  const [line, setLine] = useState(null);
  useEffect(() => {
    if (!db || !uid) return undefined;
    return onSnapshot(doc(db, "publicProfiles", uid), (s) => setLine(freshLine(s.exists() ? s.data() : null)), () => setLine(null));
  }, [db, uid]);
  return uid ? line : null;
}

// uid → line, for the people you follow (at most 40, read once per change in the list).
export function useRightNowLines(db, uids = []) {
  const [lines, setLines] = useState({});
  const key = uids.slice(0, 40).sort().join(",");
  useEffect(() => {
    if (!db || !key) return undefined;
    let alive = true;
    Promise.all(key.split(",").map((u) => readPublicProfile(db, u).then((p) => [u, freshLine(p)]).catch(() => [u, null])))
      .then((rows) => { if (alive) setLines(Object.fromEntries(rows.filter(([, l]) => l))); });
    return () => { alive = false; };
  }, [db, key]);
  return lines;
}
