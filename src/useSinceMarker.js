// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// useSinceMarker.js — when you were last here, on this device (3.32). See sinceLast.js.
//
// The time you last left the home screen is kept on the device (a "seen" marker, per account —
// deviceOwner.js keeps it with the account on sign-out). On opening it becomes the start of
// "Since you were last here", and the marker moves on to now; coming back to an app that sat in
// the background for half an hour or more starts a new window from when you left.

import { useEffect, useState } from "react";
import { sinceWindow } from "./sinceLast.js";

export const SINCE_KEY = "seen_home_seen_at";
const AWAY_MS = 30 * 60 * 1000;

const read = () => { try { return Number(localStorage.getItem(SINCE_KEY)) || 0; } catch { return 0; } };
const write = (t = Date.now()) => { try { localStorage.setItem(SINCE_KEY, String(t)); } catch { /* private mode */ } };

export function useSinceMarker(uid) {
  const [state, setState] = useState({ uid: null, since: null });
  useEffect(() => {
    if (!uid) return undefined;
    const open = setTimeout(() => { setState({ uid, since: sinceWindow(read()) }); write(); }, 0);
    let hiddenAt = 0;
    const onVis = () => {
      if (document.visibilityState === "hidden") { hiddenAt = Date.now(); write(hiddenAt); return; }
      if (hiddenAt && Date.now() - hiddenAt >= AWAY_MS) setState({ uid, since: sinceWindow(read()) });
      hiddenAt = 0;
    };
    document.addEventListener("visibilitychange", onVis);
    return () => { clearTimeout(open); document.removeEventListener("visibilitychange", onVis); };
  }, [uid]);
  return state.uid === uid ? state.since : null;
}
