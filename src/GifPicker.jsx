// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// GifPicker.jsx — the bottom sheet for choosing a GIF to attach to a post.
//
// Sheet mechanics (portal, backdrop, slide-up, drag handle) deliberately match StickerPicker so
// the two feel like one app rather than two features written months apart.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Search, Loader2 } from "lucide-react";
import { featuredGifs, searchGifs, isKlipyConfigured } from "./klipy";

// Long enough that a normal typing speed produces one request per word rather than one per
// letter, short enough that it still feels like it is searching as you type.
const DEBOUNCE_MS = 350;

export default function GifPicker({ onClose, onPick }) {
  const [query, setQuery] = useState("");
  const [gifs, setGifs] = useState([]);
  // Whether there is a key is known at mount, not discovered — so it is the INITIAL state
  // rather than something an effect sets on the way past. Same end result, one less render,
  // and it keeps the mount effect to the job effects are for.
  const [state, setState] = useState(() => (isKlipyConfigured() ? "loading" : "unconfigured"));
  const abortRef = useRef(null);

  const run = useCallback(async (q) => {
    if (!isKlipyConfigured()) { setState("unconfigured"); return; }

    // Abort the request in flight. Without this an early slow response can land after a later
    // fast one and repaint the grid with results for a query already typed past — the grid
    // would show hits for "ha" while the box reads "happy birthday".
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState("loading");
    try {
      const results = await searchGifs(q, controller.signal);
      if (controller.signal.aborted) return;
      setGifs(results);
      setState("ready");
    } catch (err) {
      if (err?.name === "AbortError") return; // superseded, not failed
      console.error("[gif search]", err?.message);
      setState("error");
    }
  }, []);

  // First open: Klipy's trending page, so the sheet is never an empty box asking for input.
  useEffect(() => {
    if (!isKlipyConfigured()) return; // already the initial state; nothing to fetch
    const controller = new AbortController();
    abortRef.current = controller;
    featuredGifs(controller.signal)
      .then((results) => { if (!controller.signal.aborted) { setGifs(results); setState("ready"); } })
      .catch((err) => { if (err?.name !== "AbortError") setState("error"); });
    return () => controller.abort();
  }, []);

  // Debounced search on every keystroke after the first render.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(() => run(query), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query, run]);

  // Abort whatever is in flight when the sheet closes, so a late response cannot call setState
  // on an unmounted component.
  useEffect(() => () => abortRef.current?.abort(), []);

  return createPortal(
    <div data-portal className="fixed inset-0 z-[260] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative sheet-slide-up rounded-t-3xl bg-white shadow-2xl max-h-[78dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>

        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        <div className="flex items-center justify-between px-5 py-2 flex-shrink-0">
          <div>
            <p className="text-sm font-bold text-slate-800">Add a GIF</p>
            <p className="text-[11px] text-slate-400">Only people in your Focused Feed will see it</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-slate-100 transition-colors" aria-label="Close">
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        <div className="px-4 pb-2 flex-shrink-0">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-teal-400">
            <Search size={15} className="text-slate-400 flex-shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search GIFs — hug, well done, thank you…"
              className="w-full bg-transparent text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-slate-400 hover:text-slate-600 flex-shrink-0" aria-label="Clear">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-y-auto px-4 pt-1 pb-10 flex-1">
          {state === "unconfigured" && (
            // Said plainly rather than shown as a failure. Nobody using the app can fix this, so
            // it reads as "not switched on yet" rather than "something broke".
            <p className="py-10 text-center text-[13px] leading-relaxed text-slate-400">
              GIFs aren&apos;t switched on yet.<br />Your words still work beautifully. 🌱
            </p>
          )}

          {state === "loading" && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-400">
              <Loader2 size={16} className="animate-spin" /> Looking…
            </div>
          )}

          {state === "error" && (
            <div className="py-10 text-center">
              <p className="text-[13px] text-slate-500">Couldn&apos;t reach the GIF library just now.</p>
              <button onClick={() => run(query)}
                className="mt-2 rounded-lg bg-slate-100 px-3 py-1.5 text-[12px] font-semibold text-slate-600 hover:bg-slate-200 transition-colors">
                Try again
              </button>
            </div>
          )}

          {state === "ready" && gifs.length === 0 && (
            <p className="py-10 text-center text-[13px] text-slate-400">
              Nothing for “{query}”. Try another word?
            </p>
          )}

          {state === "ready" && gifs.length > 0 && (
            // Two columns with a fixed tile aspect: GIFs vary wildly in shape, and letting the
            // grid size itself to them makes the whole sheet reflow as images arrive.
            <div className="grid grid-cols-2 gap-2">
              {gifs.map((g) => (
                <button key={g.id} onClick={() => { onPick?.(g); onClose?.(); }}
                  className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-100 active:scale-95 transition-transform"
                  style={{ aspectRatio: "1 / 1" }}
                  title={g.description}>
                  <img src={g.previewUrl} alt={g.description} loading="lazy"
                    className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Attribution, as the provider's terms require wherever their results are shown. */}
        <div className="flex-shrink-0 border-t border-slate-100 px-5 py-2">
          <p className="text-center text-[10px] text-slate-400">GIFs via KLIPY</p>
        </div>
      </div>
    </div>,
    document.body
  );
}
