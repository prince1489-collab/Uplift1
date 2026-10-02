// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// viewport.js — shared by every bottom sheet that has a text box in it.

import { useEffect, useState } from "react";

// ── Keep a bottom sheet inside the part of the screen you can actually see ───────────────────
// On Android the keyboard does not shrink `100dvh`; the WebView pans the whole page up instead,
// which pushed the reply sheet's title and the message being replied to behind the status bar
// (seen in a recording of 3.5). visualViewport is the area left above the keyboard, so the sheet's
// container is pinned to exactly that, and the sheet is capped to fit inside it.
export function useVisibleViewport() {
  const read = () => {
    const vv = typeof window !== "undefined" ? window.visualViewport : null;
    return vv ? { top: vv.offsetTop, height: vv.height } : null;
  };
  const [box, setBox] = useState(read);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const on = () => setBox({ top: vv.offsetTop, height: vv.height });
    vv.addEventListener("resize", on);
    vv.addEventListener("scroll", on);
    return () => { vv.removeEventListener("resize", on); vv.removeEventListener("scroll", on); };
  }, []);
  return box;
}
export const sheetBox = (box) => (box ? { top: box.top, height: box.height, bottom: "auto" } : undefined);
export const sheetCap = (box) => ({ maxHeight: box ? box.height - 12 : "90dvh" });
