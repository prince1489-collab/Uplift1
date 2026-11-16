// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// dictation.js — talk instead of type (3.23).
//
// The hardest part of making someone feel seen in your own words is the typing, which is why the
// presets win. Speaking a sentence takes three seconds. So every place Seen asks you to write —
// telling someone how their words landed, a post in your own words, an answer to Seen, the
// journal — has a mic: you talk, your words appear in the box as you speak, and you can fix them
// before anything is sent. What is sent is TEXT, screened exactly like typed text; Seen never
// records, receives or stores audio.
//
// The phone's own speech service does the listening: Apple's on iPhone and iPad, Google's on
// Android (through @capacitor-community/speech-recognition), and the browser's on the web where
// it has one (Chrome, Edge, Safari). That service may process the audio on the device or on its
// maker's servers, as the privacy policy says. Where there is no speech service — Firefox, an
// Android phone without Google's — the mic simply isn't shown.
//
// What you say is ADDED to what is already in the box (joinDictation), so you can type a bit,
// talk a bit, and edit freely in between.

import { useCallback, useEffect, useRef, useState } from "react";
import { isNativeApp } from "./nativePush.js";

// ── Pure: where the spoken words go ──────────────────────────────────────────────────────────
// `base` is the box as it was when you started talking; `spoken` is everything heard since.
export function joinDictation(base, spoken, max = Infinity) {
  const said = String(spoken || "").trim();
  const before = String(base || "").replace(/\s+$/, "");
  if (!said) return String(base || "").slice(0, max);
  if (!before) return (said.charAt(0).toUpperCase() + said.slice(1)).slice(0, max);
  // After the end of a sentence, start a new one with a capital.
  const next = /[.!?…]$/.test(before) ? said.charAt(0).toUpperCase() + said.slice(1) : said;
  return `${before} ${next}`.slice(0, max);
}

// Which speech service this device has: "native", "web", or null for none.
export function dictationSupport() {
  try {
    if (isNativeApp()) return "native";
    if (typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition)) return "web";
  } catch { /* fall through */ }
  return null;
}

const language = () => {
  try { return navigator.language || "en-GB"; } catch { return "en-GB"; }
};

const MESSAGES = {
  denied: "Allow the microphone for Seen in your phone's settings to talk instead of type.",
  unavailable: "Talking isn't available on this device — typing still works.",
  failed: "Couldn't hear that — try again, or type it.",
};

// ── The hook ─────────────────────────────────────────────────────────────────────────────────
// `text` / `setText`: the box being dictated into. `max`: its length limit.
export function useDictation({ text, setText, max = Infinity }) {
  const [support] = useState(dictationSupport);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState("");
  const textRef = useRef(text);
  useEffect(() => { textRef.current = text; }, [text]);
  const session = useRef(null); // { stop(), cleanup() }

  const finish = useCallback(() => {
    if (session.current?.token) session.current.token.live = false;
    try { session.current?.cleanup?.(); } catch { /* already gone */ }
    session.current = null;
    setListening(false);
  }, []);

  const start = useCallback(async () => {
    if (!support || session.current) return;
    setError("");
    const base = textRef.current;
    // Once stopped, nothing more is written: a result arriving after Send would otherwise put the
    // words just sent back in the box.
    const token = { live: true };
    const hear = (spoken) => { if (token.live) setText(joinDictation(base, spoken, max)); };

    if (support === "native") {
      // Held from the first tap, so a second tap during the permission prompt starts nothing.
      session.current = { token, stop: () => {}, cleanup: () => {} };
      try {
        const { SpeechRecognition } = await import("@capacitor-community/speech-recognition");
        const { available } = await SpeechRecognition.available();
        if (!available) { finish(); setError(MESSAGES.unavailable); return; }
        let perm = await SpeechRecognition.checkPermissions();
        if (perm?.speechRecognition !== "granted") perm = await SpeechRecognition.requestPermissions();
        if (perm?.speechRecognition !== "granted") { finish(); setError(MESSAGES.denied); return; }
        const handles = [
          await SpeechRecognition.addListener("partialResults", (d) => { const t = d?.matches?.[0]; if (t) hear(t); }),
          await SpeechRecognition.addListener("listeningState", (d) => { if (d?.status === "stopped") finish(); }),
        ];
        session.current = {
          token,
          stop: () => SpeechRecognition.stop().catch(() => {}),
          cleanup: () => handles.forEach((h) => h?.remove?.()),
        };
        setListening(true);
        await SpeechRecognition.start({ language: language(), partialResults: true, popup: false, maxResults: 1 });
      } catch (err) {
        const msg = String(err?.message || err || "");
        finish();
        setError(/permission|denied|not authori/i.test(msg) ? MESSAGES.denied : MESSAGES.failed);
      }
      return;
    }

    // The browser's own speech recognition.
    try {
      const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const rec = new Recognition();
      rec.lang = language();
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (e) => {
        let heard = "";
        for (let i = 0; i < e.results.length; i++) heard += `${e.results[i][0].transcript} `;
        hear(heard);
      };
      rec.onerror = (e) => {
        if (e?.error === "not-allowed" || e?.error === "service-not-allowed") setError(MESSAGES.denied);
        else if (e?.error && e.error !== "no-speech" && e.error !== "aborted") setError(MESSAGES.failed);
      };
      rec.onend = () => finish();
      session.current = { token, stop: () => rec.stop(), cleanup: () => { rec.onresult = rec.onerror = rec.onend = null; } };
      setListening(true);
      rec.start();
    } catch {
      finish();
      setError(MESSAGES.failed);
    }
  }, [support, setText, max, finish]);

  const stop = useCallback(() => {
    const s = session.current;
    if (!s) return;
    if (s.token) s.token.live = false;
    try { s.stop(); } catch { /* ignore */ }
    // The service says when it has stopped; this makes sure the button never stays red if it doesn't.
    setTimeout(() => { if (session.current === s) finish(); }, 1500);
  }, [finish]);

  // Leaving the sheet while listening stops the microphone.
  useEffect(() => () => { try { session.current?.stop?.(); session.current?.cleanup?.(); } catch { /* ignore */ } }, []);

  return { supported: Boolean(support), listening, error, toggle: listening ? stop : start, stop };
}
