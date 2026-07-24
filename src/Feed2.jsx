// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// Feed2.jsx — v2 "Connect" tab pieces (PREVIEW). The Worldwide Message Board shows
// strangers' messages (people you haven't added to your focused feed); the Focused Feed
// shows only people you've selected. Likes, private replies and "kind moment" broadcasts
// are SIMULATED (localStorage only, never written to Firestore) so the preview never leaks
// content into the real feed production testers see. Real moderation/DMs are merge-time work.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Heart, MessageCircle, UserPlus, UserCheck, Loader2, Sparkles, ChevronRight } from "lucide-react";
import { FLAG_MAP } from "./MicroAnimations";
import { awardPoints } from "./points";

const POSTS_KEY = "seen_v2_local_posts";
const FOCUS_KEY = "seen_v2_focused_uids";
const MOMENTS_KEY = "seen_v2_kind_moments";
const LIKES_KEY = "seen_v2_board_likes";
const STORIES_KEY = "seen_v2_stories";
const MAX_LEN = 80;
const BLOCKLIST = ["hate", "kill", "stupid", "ugly", "idiot", "loser"];

const readJSON = (k, fb) => { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(fb)); } catch { return fb; } };
const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

export const loadLocalPosts = () => readJSON(POSTS_KEY, []);
const saveLocalPosts = (l) => writeJSON(POSTS_KEY, l.slice(0, 30));
export const loadFocused = () => readJSON(FOCUS_KEY, []);
export const loadKindMoments = () => readJSON(MOMENTS_KEY, []);
export const loadLocalStories = () => readJSON(STORIES_KEY, []);
// Add a Featured Story (from a shared journal reflection). Device-local; never Firestore.
export function addLocalStory(story) {
  const id = `story_${loadLocalStories().length + 1}_${(story.text || "").length}`;
  const next = [{ id, ...story, ts: Date.now() }, ...loadLocalStories()].slice(0, 20);
  writeJSON(STORIES_KEY, next);
  return next;
}
const flagFor = (c) => (c && FLAG_MAP[c] ? FLAG_MAP[c] : "🌍");
const firstName = (n) => (n || "Someone").split(" ")[0];

// ── Worldwide Message Board — strangers only, full messages, like + reply + follow ──
export function WorldwideBoard({ messages = [], myUid, focusedUids = [], onToggleFocus, onReplyPrivately }) {
  const focusedSet = useMemo(() => new Set(focusedUids), [focusedUids]);
  const strangers = useMemo(
    () => messages.filter((m) => m.uid && m.uid !== myUid && m.uid !== "system" && m.text && !focusedSet.has(m.uid)).slice(0, 25),
    [messages, myUid, focusedSet]
  );
  const [likes, setLikes] = useState(() => readJSON(LIKES_KEY, {}));
  const like = (id) => {
    const nowLiked = !likes[id];
    const next = { ...likes, [id]: nowLiked }; setLikes(next); writeJSON(LIKES_KEY, next);
    if (nowLiked) { try { awardPoints("like"); } catch { /* ignore */ } } // waters the tree (device-local)
  };

  return (
    <div className="border-b border-slate-100 bg-white px-3 py-2.5 flex-shrink-0">
      <p className="px-1 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400">🌍 Worldwide Message Board</p>
      {strangers.length === 0 ? (
        <div className="rounded-2xl bg-teal-50 px-3 py-4 text-center text-[12px] text-slate-500">
          💛 Kind messages from around the world will appear here.
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollSnapType: "x mandatory" }}>
          {strangers.map((m) => {
            const following = focusedSet.has(m.uid);
            return (
              <div key={m.id} className="flex-shrink-0 rounded-2xl border border-slate-200 bg-slate-50 p-3 flex flex-col"
                style={{ width: "78%", minHeight: 128, scrollSnapAlign: "start" }}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-sm">{flagFor(m.country)}</span>
                  <span className="text-[11px] font-semibold text-slate-500 truncate flex-1">{firstName(m.sender)}</span>
                  <button onClick={() => onToggleFocus?.(m)} title={following ? "In your focused feed" : "Add to focused feed"}
                    className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${following ? "bg-teal-100 text-teal-700" : "bg-white border border-slate-200 text-slate-500"}`}>
                    {following ? <UserCheck size={11} /> : <UserPlus size={11} />}{following ? "Following" : "Follow"}
                  </button>
                </div>
                <p className="flex-1 text-[14px] leading-snug text-slate-800 font-medium">“{m.text}”</p>
                <div className="mt-2 flex items-center gap-2">
                  <button onClick={() => like(m.id)}
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${likes[m.id] ? "bg-rose-50 text-rose-600" : "bg-white border border-slate-200 text-slate-500"}`}>
                    <Heart size={12} fill={likes[m.id] ? "currentColor" : "none"} /> {likes[m.id] ? "Liked" : "Like"}
                  </button>
                  <button onClick={() => onReplyPrivately?.(m)}
                    className="flex items-center gap-1 rounded-full bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                    <MessageCircle size={12} /> Reply privately
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Kind-moment card (a consented "shared a kind moment") ─────────────────────
export function KindMomentCard({ moment }) {
  return (
    <div className="mb-2 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white px-4 py-2.5 flex items-center gap-2"
      style={{ animation: "seenFadeUp 400ms ease both" }}>
      <span className="text-lg flex-shrink-0">⭐</span>
      <p className="text-[12px] text-slate-600 leading-snug">
        <strong className="text-slate-800">{moment.aName} {flagFor(moment.aCountry)}</strong> and{" "}
        <strong className="text-slate-800">{moment.bName} {flagFor(moment.bCountry)}</strong> shared a kind moment.
      </p>
    </div>
  );
}

// ── Private reply sheet (simulated) → creates a kind moment on send ───────────
export function PrivateReplySheet({ target, me, onDone, onClose }) {
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const send = () => {
    if (!text.trim() || sent) return;
    setSent(true);
    const moment = {
      id: `km_${Date.now()}`,
      aName: firstName(me?.fullName) || "You", aCountry: me?.country ?? null,
      bName: firstName(target?.sender), bCountry: target?.country ?? null,
      ts: Date.now(),
    };
    const next = [moment, ...loadKindMoments()].slice(0, 30);
    writeJSON(MOMENTS_KEY, next);
    try { awardPoints("reply"); } catch { /* ignore */ } // waters the tree (device-local)
    onDone?.(next);
    setTimeout(() => onClose?.(), 1000);
  };
  return createPortal(
    <div data-portal className="fixed inset-0 z-[240] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative sheet-slide-up rounded-t-3xl bg-white shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-slate-200" /></div>
        <div className="px-5 pb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Reply privately to {firstName(target?.sender)} {flagFor(target?.country)}</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Close"><X size={20} /></button>
        </div>
        <div className="px-5 pb-8 space-y-3">
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-[13px] text-slate-500 italic">“{target?.text}”</div>
          <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 120))} rows={2} autoFocus
            placeholder="A private word of kindness, just between you two…"
            className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none" />
          {sent && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] font-semibold text-amber-700">
              Delivered ✓ — you both shared a kind moment ⭐ (preview)
            </div>
          )}
          <button onClick={send} disabled={!text.trim() || sent}
            className="w-full rounded-2xl bg-teal-600 py-3.5 text-sm font-bold text-white hover:bg-teal-700 transition-colors disabled:opacity-50">
            Send privately
          </button>
          <p className="text-center text-[10px] text-slate-400 leading-relaxed">
            Preview: private replies are simulated on this device. Only the two of you would see the message;
            a small “shared a kind moment ⭐” note appears in the feed.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Focused-feed empty state ──────────────────────────────────────────────────
export function FocusedFeedEmpty() {
  return (
    <div className="mx-2 my-4 rounded-2xl border border-slate-200 bg-white px-4 py-6 text-center">
      <div className="text-3xl mb-2">👋</div>
      <p className="text-sm font-bold text-slate-800">Your focused feed is quiet</p>
      <p className="mt-1 text-[12px] text-slate-500 leading-relaxed">
        Tap <strong>Follow</strong> on people in the Worldwide Message Board above to see their kind
        messages here — just the people you choose.
      </p>
    </div>
  );
}

// ── Post composer (simulated free-text) ───────────────────────────────────────
export function PostComposer({ profile, onPosted, onClose }) {
  const [text, setText] = useState("");
  const [anon, setAnon] = useState(false);
  const [state, setState] = useState("idle");
  const len = text.trim().length;
  const submit = async () => {
    if (!len || state === "checking") return;
    setState("checking");
    await new Promise((r) => setTimeout(r, 650));
    if (BLOCKLIST.some((w) => text.toLowerCase().includes(w))) { setState("rejected"); return; }
    const post = { id: `local_${Date.now()}`, text: text.trim(), anon, sender: anon ? "Anonymous" : firstName(profile?.fullName), country: anon ? null : (profile?.country ?? null), timestamp: Date.now(), preview: true };
    const next = [post, ...loadLocalPosts()];
    saveLocalPosts(next); setState("done"); onPosted?.(next);
    setTimeout(() => onClose?.(), 900);
  };
  return createPortal(
    <div data-portal className="fixed inset-0 z-[240] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative sheet-slide-up rounded-t-3xl bg-white shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-slate-200" /></div>
        <div className="px-5 pb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Share some kindness</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Close"><X size={20} /></button>
        </div>
        <div className="px-5 pb-8 space-y-3">
          <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))} rows={3} autoFocus
            placeholder="Write something kind, hopeful, or honest…"
            className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] text-slate-900 placeholder:text-slate-400 focus:border-teal-400 focus:outline-none" />
          <div className="flex items-center justify-between">
            <button onClick={() => setAnon((a) => !a)}
              className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-[12px] font-semibold ${anon ? "border-violet-300 bg-violet-50 text-violet-700" : "border-slate-200 bg-white text-slate-500"}`}>
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
            <div className="rounded-xl border border-teal-200 bg-teal-50 px-3 py-2.5 text-[12px] font-semibold text-teal-700">Shared ✓ (preview — only you can see it)</div>
          )}
          <button onClick={submit} disabled={!len || state === "checking"}
            className="w-full rounded-2xl bg-teal-600 py-3.5 text-sm font-bold text-white hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {state === "checking" ? (<><Loader2 size={16} className="animate-spin" /> Checking kindness…</>) : "Share"}
          </button>
          <p className="text-center text-[10px] text-slate-400 leading-relaxed">
            Preview: your post is screened by a (mock) kindness check and saved only on this device. The live
            version will screen every post with AI moderation before anyone sees it.
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Featured Stories — reflections members chose to share (device-local preview) ──
export function FeaturedStories({ stories = [], onOpen }) {
  if (!stories.length) return null;
  return (
    <div className="mb-3">
      <p className="px-1 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-400 flex items-center gap-1">
        <Sparkles size={12} className="text-amber-400" /> Featured stories
      </p>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide" style={{ scrollSnapType: "x mandatory" }}>
        {stories.map((s) => (
          <button key={s.id} onClick={() => onOpen?.(s)}
            className="flex-shrink-0 rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-3 text-left flex flex-col"
            style={{ width: "80%", minHeight: 132, scrollSnapAlign: "start" }}>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-sm">{s.anonymous ? "🕊️" : flagFor(s.country)}</span>
              <span className="text-[11px] font-semibold text-slate-500 truncate flex-1">{s.anonymous ? "Someone, somewhere" : firstName(s.authorName)}</span>
              <ChevronRight size={14} className="text-amber-400" />
            </div>
            <p className="flex-1 text-[14px] leading-snug text-slate-800 font-medium line-clamp-4">"{s.text}"</p>
            <span className="mt-2 text-[10px] font-semibold text-amber-600">Read story →</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export function FeaturedStoryReader({ story, onClose }) {
  if (!story) return null;
  return createPortal(
    <div data-portal className="fixed inset-0 z-[260] flex flex-col bg-white">
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 flex-shrink-0">
        <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
        <h2 className="flex-1 text-sm font-bold text-slate-800 flex items-center gap-1.5"><Sparkles size={15} className="text-amber-400" /> Featured story</h2>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="mx-auto max-w-md space-y-5">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{story.anonymous ? "🕊️" : flagFor(story.country)}</span>
            <div>
              <p className="text-sm font-bold text-slate-800">{story.anonymous ? "Someone, somewhere" : (story.authorName || "A member")}</p>
              <p className="text-[11px] text-slate-400">A shared reflection</p>
            </div>
          </div>
          <p className="text-lg leading-relaxed text-slate-800 font-medium whitespace-pre-wrap">"{story.text}"</p>
          {Array.isArray(story.enrich) && story.enrich.map((e, i) => (
            <div key={i} className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-teal-600">{e.q}</p>
              <p className="mt-1 text-[15px] text-slate-700 leading-relaxed whitespace-pre-wrap">{e.a}</p>
            </div>
          ))}
          <p className="pt-4 text-center text-[10px] text-slate-400">Preview: featured stories are stored on this device only.</p>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Strip of your own preview posts ───────────────────────────────────────────
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
