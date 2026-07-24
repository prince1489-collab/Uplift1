// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// Feed2.jsx — v2 Feed pieces (PREVIEW): a world-kindness bulletin ribbon and a free-text
// post composer. IMPORTANT: free-text posts are SIMULATED — saved to localStorage only,
// never written to Firestore — so the preview never leaks user-written content into the
// real feed that production testers see. Real server-side moderation + rules lockdown +
// App Store copy updates are merge-time work; the mock moderation here just demos the UX.

import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Sparkles, Loader2, ShieldCheck } from "lucide-react";
import { FLAG_MAP } from "./MicroAnimations";

const POSTS_KEY = "seen_v2_local_posts";
const MAX_LEN = 80;
// A tiny demo blocklist so the "kind rejection" state is visible in the preview.
const BLOCKLIST = ["hate", "kill", "stupid", "ugly", "idiot", "loser"];

export function loadLocalPosts() {
  try { return JSON.parse(localStorage.getItem(POSTS_KEY) || "[]"); } catch { return []; }
}
function saveLocalPosts(list) {
  try { localStorage.setItem(POSTS_KEY, JSON.stringify(list.slice(0, 30))); } catch { /* ignore */ }
}

// ── Bulletin ribbon: rotating one-liners of world kindness ────────────────────
export function BulletinRibbon({ messages = [], myUid, onCompose }) {
  const items = useMemo(
    () => messages.filter((m) => m.uid && m.uid !== myUid && m.uid !== "system" && m.text).slice(0, 20),
    [messages, myUid]
  );
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (items.length < 2) return;
    const t = setInterval(() => setIdx((i) => i + 1), 4000);
    return () => clearInterval(t);
  }, [items.length]);

  const cur = items.length ? items[idx % items.length] : null;
  const flag = cur?.country && FLAG_MAP[cur.country] ? FLAG_MAP[cur.country] : "🌍";

  return (
    <div className="border-b border-slate-100 bg-white px-3.5 py-1.5 flex-shrink-0 flex items-center gap-2">
      <div className="flex-1 min-w-0 rounded-xl bg-teal-50 px-3 py-2 overflow-hidden">
        {cur ? (
          <p key={idx} className="text-[12px] text-slate-600 truncate" style={{ animation: "seenFadeUp 400ms ease both" }}>
            <span className="mr-1">{flag}</span>
            <span className="font-semibold text-slate-700">{(cur.sender || "Someone").split(" ")[0]}</span>
            <span className="text-slate-400"> · </span>
            <span className="italic">“{cur.text}”</span>
          </p>
        ) : (
          <p className="text-[12px] text-slate-500">💛 Kindness is travelling the world right now…</p>
        )}
      </div>
      <button onClick={onCompose}
        className="flex-shrink-0 rounded-full bg-teal-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-teal-700 transition-colors flex items-center gap-1">
        <Sparkles size={11} /> Share
      </button>
    </div>
  );
}

// ── Post composer (simulated free-text) ───────────────────────────────────────
export function PostComposer({ profile, onPosted, onClose }) {
  const [text, setText] = useState("");
  const [anon, setAnon] = useState(false);
  const [state, setState] = useState("idle"); // idle | checking | rejected | done
  const len = text.trim().length;

  const submit = async () => {
    if (!len || state === "checking") return;
    setState("checking");
    // Simulated AI moderation — a short delay + a tiny local blocklist demo.
    await new Promise((r) => setTimeout(r, 650));
    const lower = text.toLowerCase();
    if (BLOCKLIST.some((w) => lower.includes(w))) { setState("rejected"); return; }
    const post = {
      id: `local_${Date.now()}`,
      text: text.trim(),
      anon,
      sender: anon ? "Anonymous" : ((profile?.fullName || "You").split(" ")[0]),
      country: anon ? null : (profile?.country ?? null),
      timestamp: Date.now(),
      preview: true,
    };
    const next = [post, ...loadLocalPosts()];
    saveLocalPosts(next);
    setState("done");
    onPosted?.(next);
    setTimeout(() => onClose?.(), 900);
  };

  return createPortal(
    <div data-portal className="fixed inset-0 z-[240] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative sheet-slide-up rounded-t-3xl bg-white shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-2 flex-shrink-0"><div className="w-10 h-1 rounded-full bg-slate-200" /></div>
        <div className="px-5 pb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Share some kindness</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Close"><X size={20} /></button>
        </div>
        <div className="px-5 pb-8 space-y-3">
          <textarea
            value={text} onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
            rows={3} autoFocus placeholder="Write something kind, hopeful, or honest…"
            className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none" />
          <div className="flex items-center justify-between">
            <button onClick={() => setAnon((a) => !a)}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                anon ? "border-violet-300 bg-violet-50 text-violet-700" : "border-slate-200 bg-white text-slate-500"
              }`}>
              {anon ? "🕶️ Posting anonymously" : "👤 Posting as you"}
            </button>
            <span className={`text-[11px] ${len > MAX_LEN - 10 ? "text-amber-600" : "text-slate-400"}`}>{len}/{MAX_LEN}</span>
          </div>

          {state === "rejected" && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5">
              <p className="text-[12px] font-semibold text-rose-700">Let's keep it kind 💛</p>
              <p className="text-[11px] text-rose-500 mt-0.5">That message didn't pass our kindness check. Try rephrasing it warmly.</p>
            </div>
          )}
          {state === "done" && (
            <div className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5 flex items-center gap-2">
              <ShieldCheck size={16} className="text-teal-600" />
              <p className="text-[12px] font-semibold text-teal-700">Shared ✓ (preview — only you can see it)</p>
            </div>
          )}

          <button onClick={submit} disabled={!len || state === "checking"}
            className="w-full rounded-2xl bg-teal-600 py-3.5 text-sm font-bold text-white hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {state === "checking" ? (<><Loader2 size={16} className="animate-spin" /> Checking kindness…</>) : "Share"}
          </button>
          <p className="text-center text-[10px] text-slate-400 leading-relaxed">
            Preview: your post is screened by a (mock) kindness check and saved only on this device.
            The live version will screen every post with AI moderation before anyone sees it.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Strip of your own preview posts (only you can see these) ──────────────────
export function PreviewPostsStrip({ posts, onClear }) {
  if (!posts?.length) return null;
  return (
    <div className="mb-3 rounded-2xl border border-violet-200 bg-violet-50/60 p-3">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[10px] font-bold uppercase tracking-wide text-violet-600">Your preview posts · only you see these</p>
        <button onClick={onClear} className="text-[10px] font-semibold text-slate-400 hover:text-rose-500">Clear</button>
      </div>
      <div className="space-y-1.5">
        {posts.map((p) => (
          <div key={p.id} className="rounded-xl bg-white border border-violet-100 px-3 py-2">
            <p className="text-[13px] font-medium text-slate-800">{p.text}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">— {p.sender}{p.anon ? " 🕶️" : ""}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
