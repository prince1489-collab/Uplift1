// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// backStack.js — Android/browser back-button support for a state-driven SPA.
//
// The app navigates with React state (tabs, sheets, overlays), so the browser history
// has a single entry and the Android hardware back button closes the TWA outright
// (QA finding #2). This module keeps ONE sentinel history entry armed whenever any
// "layer" (sheet / overlay / panel / non-home tab) is open. Pressing back pops the
// sentinel; we close the top-most open layer and re-arm if others remain. With no
// layers open, back behaves normally and exits from the home screen.
//
// Usage: useBackLayer(isOpen, closeFn) — call once per closable layer.

import { useEffect, useRef } from "react";

const closers = []; // open layers, oldest → newest (top of stack = last)
let armed = false;
let listening = false;

function arm() {
  if (armed || typeof window === "undefined") return;
  try {
    window.history.pushState({ seenBack: true }, "");
    armed = true;
  } catch { /* ignore */ }
}

function onPop() {
  armed = false;
  const top = closers[closers.length - 1];
  if (!top) return; // nothing open — at the root, let back behave normally
  try { top.close(); } catch { /* ignore */ }
  // The closed layer unregisters via its effect cleanup after React re-renders;
  // if other layers are (or remain) open, keep a sentinel so back keeps working.
  if (closers.length > 1) arm();
}

function ensureListener() {
  if (listening || typeof window === "undefined") return;
  window.addEventListener("popstate", onPop);
  listening = true;
}

export function useBackLayer(isOpen, close) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!isOpen) return;
    ensureListener();
    const entry = { close: () => closeRef.current?.() };
    closers.push(entry);
    arm();
    return () => {
      const i = closers.indexOf(entry);
      if (i >= 0) closers.splice(i, 1);
      // Last layer closed via its own UI (✕ / backdrop): consume the stale sentinel
      // so the user's next back press isn't silently swallowed.
      if (!closers.length && armed) {
        try { window.history.back(); } catch { /* ignore */ }
      }
    };
  }, [isOpen]);
}
