// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.
//
// Feed2.jsx — v2 "Connect" tab pieces (PREVIEW). The Worldwide Feed shows strangers'
// messages (people you haven't followed); the Focused Feed below it shows only the
// people you follow. Likes, private replies and "kind moment" broadcasts
// are SIMULATED (localStorage only, never written to Firestore) so the preview never leaks
// content into the real feed production testers see. Real moderation/DMs are merge-time work.

import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { doc, getDoc, onSnapshot, collection } from "firebase/firestore";
import { X, Heart, MessageCircle, UserPlus, UserCheck, Loader2, Sparkles, ChevronRight } from "lucide-react";
import { FLAG_MAP } from "./MicroAnimations";
import { awardPoints } from "./points";

const POSTS_KEY = "seen_v2_local_posts";
const FOCUS_KEY = "seen_v2_focused_uids"; // legacy: bare uid array, migrated into FOLLOWS_KEY
const FOLLOWS_KEY = "seen_v2_follows";    // [{ uid, name, country, label }]
const MOMENTS_KEY = "seen_v2_kind_moments";
const LIKES_KEY = "seen_v2_board_likes";
const STORIES_KEY = "seen_v2_stories";
const MAX_LEN = 80;
const BLOCKLIST = ["hate", "kill", "stupid", "ugly", "idiot", "loser"];

const readJSON = (k, fb) => { try { return JSON.parse(localStorage.getItem(k) || JSON.stringify(fb)); } catch { return fb; } };
const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

export const loadLocalPosts = () => readJSON(POSTS_KEY, []);
const saveLocalPosts = (l) => writeJSON(POSTS_KEY, l.slice(0, 30));

// ── Follows: who you follow, with a denormalized name/country and an optional label ──
// Suggested labels; users can also type their own via "Custom…".
export const FOLLOW_LABELS = ["Family", "Friend", "Work", "Neighbour"];

// Reads the follow list, migrating the legacy bare-uid array on first run so existing
// testers keep everyone they already followed.
export function loadFollows() {
  const stored = readJSON(FOLLOWS_KEY, null);
  if (Array.isArray(stored)) return stored;
  const legacy = readJSON(FOCUS_KEY, []);
  const migrated = (Array.isArray(legacy) ? legacy : [])
    .filter(Boolean)
    .map((uid) => ({ uid, name: "", country: null, label: null }));
  if (migrated.length) writeJSON(FOLLOWS_KEY, migrated);
  return migrated;
}
export const saveFollows = (list) => writeJSON(FOLLOWS_KEY, list.slice(0, 200));

export const loadKindMoments = () => readJSON(MOMENTS_KEY, []);

// Route a kind moment to the right feed. A moment belongs in your Focused Feed when either
// person in it is you or someone you follow; otherwise it's two strangers, so it broadcasts
// in the Worldwide Feed. Legacy moments predate the uids and were always your own, so they
// stay focused.
export function splitKindMoments(moments = [], focusedUids = [], myUid) {
  const near = new Set([...focusedUids, myUid].filter(Boolean));
  const focused = [], worldwide = [];
  for (const km of moments) {
    const known = km.aUid || km.bUid;
    const isNear = !known || near.has(km.aUid) || near.has(km.bUid);
    (isNear ? focused : worldwide).push(km);
  }
  return { focused, worldwide };
}

// Preview-only: two-stranger moments can't arise on a single device (you're always one of
// the pair), so seed a couple from real feed authors purely so the Worldwide Feed routing is
// testable. Marked `demo` and rendered with a "preview" tag; device-local, never Firestore.
export function seedDemoKindMoments(messages = [], myUid) {
  const existing = loadKindMoments();
  if (existing.some((km) => km.demo)) return existing;
  const authors = [];
  const seen = new Set([myUid]);
  for (const m of messages) {
    if (!m.uid || seen.has(m.uid) || m.uid === "system" || !m.sender) continue;
    seen.add(m.uid);
    authors.push({ uid: m.uid, name: firstName(m.sender), country: m.country ?? null });
    if (authors.length === 4) break;
  }
  if (authors.length < 2) return existing;
  const pairs = authors.length >= 4 ? [[0, 1], [2, 3]] : [[0, 1]];
  const demos = pairs.map(([i, j], n) => ({
    id: `km_demo_${authors[i].uid}_${authors[j].uid}`,
    aUid: authors[i].uid, aName: authors[i].name, aCountry: authors[i].country,
    bUid: authors[j].uid, bName: authors[j].name, bCountry: authors[j].country,
    demo: true,
    ts: Date.now() - (n + 1) * 3600000,
  }));
  const next = [...existing, ...demos].slice(0, 30);
  writeJSON(MOMENTS_KEY, next);
  return next;
}
// Private replies *received* on one of my messages, keyed by messageId. Real inbound
// replies are merge-time work — this store exists so the viewer is ready for them.
const REPLIES_IN_KEY = "seen_v2_replies_received";
export const loadRepliesReceived = (messageId) => {
  const all = readJSON(REPLIES_IN_KEY, {});
  return Array.isArray(all?.[messageId]) ? all[messageId] : [];
};
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

// ── Worldwide Feed — a compact, single-broadcast rotator ──────────────────────
// One stranger's message shows at a time (~2 lines), auto-rotating every few seconds.
// Tap the message to reveal Like / Reply / Follow — collapsed by default to save space.
// Tinted + pinned above the scroller so it reads as a distinct band, separate from the
// Focused Feed below it.
const ROTATE_MS = 5000;
export function WorldwideBoard({ messages = [], myUid, focusedUids = [], moments = [], onToggleFocus, onReplyPrivately }) {
  const focusedSet = useMemo(() => new Set(focusedUids), [focusedUids]);
  // Strangers' messages and stranger-to-stranger kind moments share one rotation, so a
  // moment takes its turn in the same slot instead of adding fixed height below it.
  const items = useMemo(() => {
    const msgs = messages
      .filter((m) => m.uid && m.uid !== myUid && m.uid !== "system" && m.text && !focusedSet.has(m.uid))
      .slice(0, 25)
      .map((m) => ({ type: "message", id: m.id, ts: Number(m.timestamp) || 0, msg: m }));
    const kms = moments.map((km) => ({ type: "moment", id: km.id, ts: Number(km.ts) || 0, moment: km }));
    return [...msgs, ...kms].sort((a, b) => b.ts - a.ts);
  }, [messages, myUid, focusedSet, moments]);

  const [likes, setLikes] = useState(() => readJSON(LIKES_KEY, {}));
  const [idx, setIdx] = useState(0);
  const [open, setOpen] = useState(false); // actions revealed for the current message

  // Keep the index in range as the list changes.
  useEffect(() => { if (idx >= items.length) setIdx(0); }, [items.length, idx]);

  // Auto-rotate — paused while the actions are open so people can act without it moving.
  useEffect(() => {
    if (open || items.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [open, items.length]);

  const like = (id) => {
    const nowLiked = !likes[id];
    const next = { ...likes, [id]: nowLiked }; setLikes(next); writeJSON(LIKES_KEY, next);
    if (nowLiked) { try { awardPoints("like"); } catch { /* ignore */ } } // waters the tree (device-local)
  };

  const item = items[Math.min(idx, Math.max(0, items.length - 1))];
  const m = item?.type === "message" ? item.msg : null;
  const following = m ? focusedSet.has(m.uid) : false;
  // A moment has no author to act on, so it just displays for its turn.
  useEffect(() => { if (item?.type === "moment" && open) setOpen(false); }, [item?.type, open]);

  return (
    <div className="border-b-2 border-sky-100 bg-sky-50/60 px-3 py-2 flex-shrink-0">
      <div className="flex items-center justify-between px-1 pb-1">
        <p className="text-[11px] font-bold uppercase tracking-wide text-sky-600">🌍 Worldwide Feed</p>
        <span className="text-[10px] font-semibold text-sky-400">
          {items.length > 1 ? <span className="tabular-nums">{idx + 1}/{items.length}</span> : "from strangers"}
        </span>
      </div>

      {!item ? (
        <div className="rounded-2xl bg-white/70 px-3 py-3 text-center text-[12px] text-slate-500">
          💛 Kind messages from around the world will appear here.
        </div>
      ) : item.type === "moment" ? (
        <div key={item.id} style={{ animation: "seenFadeUp 350ms ease both" }}>
          <KindMomentCard moment={item.moment} compact />
        </div>
      ) : (
        <>
          <button
            key={m.id}
            onClick={() => setOpen((v) => !v)}
            className="w-full text-left rounded-2xl border border-sky-200 bg-white px-3 py-2 active:scale-[0.99] transition-transform"
            style={{ animation: "seenFadeUp 350ms ease both" }}>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="text-sm">{flagFor(m.country)}</span>
              <span className="text-[11px] font-semibold text-slate-500 truncate flex-1">{firstName(m.sender)}</span>
              {likes[m.id] && <Heart size={11} className="text-rose-500 flex-shrink-0" fill="currentColor" />}
              <span className="text-[10px] text-slate-300 flex-shrink-0">{open ? "tap to close" : "tap to like or reply"}</span>
            </div>
            <p className="text-[13px] leading-snug text-slate-800 font-medium line-clamp-2">“{m.text}”</p>
          </button>

          {open && (
            <div className="mt-1.5 flex items-center gap-2" style={{ animation: "seenFadeUp 200ms ease both" }}>
              <button onClick={() => like(m.id)}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${likes[m.id] ? "bg-rose-50 text-rose-600" : "bg-white border border-slate-200 text-slate-500"}`}>
                <Heart size={12} fill={likes[m.id] ? "currentColor" : "none"} /> {likes[m.id] ? "Liked" : "Like"}
              </button>
              <button onClick={() => onReplyPrivately?.(m)}
                className="flex items-center gap-1 rounded-full bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                <MessageCircle size={12} /> Reply
              </button>
              <button onClick={() => onToggleFocus?.(m)}
                className={`ml-auto flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold ${following ? "bg-teal-100 text-teal-700" : "bg-white border border-slate-200 text-slate-500"}`}>
                {following ? <UserCheck size={11} /> : <UserPlus size={11} />}{following ? "Following" : "Follow"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Kind-moment card (a consented "shared a kind moment") ─────────────────────
export function KindMomentCard({ moment, compact = false }) {
  return (
    <div className={`rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white flex items-center gap-2 ${compact ? "px-3 py-2" : "mb-2 px-4 py-2.5"}`}
      style={{ animation: "seenFadeUp 400ms ease both" }}>
      <span className={`flex-shrink-0 ${compact ? "text-base" : "text-lg"}`}>⭐</span>
      <p className="text-[12px] text-slate-600 leading-snug flex-1">
        <strong className="text-slate-800">{moment.aName} {flagFor(moment.aCountry)}</strong> and{" "}
        <strong className="text-slate-800">{moment.bName} {flagFor(moment.bCountry)}</strong> shared a kind moment.
      </p>
      {moment.demo && (
        <span className="flex-shrink-0 rounded-full bg-white/70 px-1.5 py-px text-[9px] font-bold uppercase tracking-wide text-amber-500">preview</span>
      )}
    </div>
  );
}

// ── Private reply sheet (simulated) → creates a kind moment on send ───────────
export function PrivateReplySheet({ target, me, myUid, onDone, onClose }) {
  const [text, setText] = useState("");
  const [sent, setSent] = useState(false);
  const send = () => {
    if (!text.trim() || sent) return;
    setSent(true);
    // uids drive which feed the broadcast lands in (see splitKindMoments).
    const moment = {
      id: `km_${Date.now()}`,
      aUid: myUid ?? null, aName: firstName(me?.fullName) || "You", aCountry: me?.country ?? null,
      bUid: target?.uid ?? null, bName: firstName(target?.sender), bCountry: target?.country ?? null,
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
        Tap <strong>Follow</strong> on someone in the Worldwide Feed above to see their kind
        messages here — just the people you choose.
      </p>
    </div>
  );
}

// ── People you follow — review, label and unfollow (⋯ menu) ───────────────────
export function FollowingPanel({ follows = [], messages = [], onSetLabel, onUnfollow, onClose }) {
  const [editing, setEditing] = useState(null); // uid whose label chips are open
  const [customFor, setCustomFor] = useState(null); // uid typing a custom label
  const [customText, setCustomText] = useState("");

  // Follows saved before names were denormalized fall back to a live-message lookup.
  const nameFor = (f) => {
    if (f.name) return f.name;
    const hit = messages.find((m) => m.uid === f.uid && m.sender);
    return hit?.sender || "Someone";
  };
  const countryFor = (f) => f.country || messages.find((m) => m.uid === f.uid && m.country)?.country || null;

  const commitCustom = (uid) => {
    const t = customText.trim().slice(0, 20);
    if (t) onSetLabel?.(uid, t);
    setCustomFor(null); setCustomText(""); setEditing(null);
  };

  return createPortal(
    <div data-portal className="fixed inset-0 z-[160] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative sheet-slide-up rounded-t-3xl bg-white shadow-2xl max-h-[85dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>
        <div className="px-5 pb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">👥 People you follow</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Close"><X size={20} /></button>
        </div>
        <p className="px-5 pb-3 text-xs text-slate-400">
          Only these people appear in your Focused Feed. Add a label to keep them organised — it's private to you.
        </p>

        <div className="overflow-y-auto overscroll-contain px-3 pb-8">
          {follows.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              <div className="text-3xl mb-2">🕊️</div>
              You're not following anyone yet.
              <p className="mt-1 text-[12px] text-slate-400">Tap <strong>Follow</strong> on a message in the Worldwide Feed.</p>
            </div>
          ) : (
            follows.map((f) => {
              const isEditing = editing === f.uid;
              return (
                <div key={f.uid} className="rounded-2xl px-3 py-2.5 hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <span style={{ fontSize: "15px" }}>{flagFor(countryFor(f))}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{nameFor(f)}</p>
                      <button onClick={() => { setEditing(isEditing ? null : f.uid); setCustomFor(null); }}
                        className="text-[11px] font-semibold text-teal-600 hover:text-teal-700">
                        {f.label ? `${f.label} · change` : "Add a label"}
                      </button>
                    </div>
                    <button onClick={() => onUnfollow?.(f.uid)}
                      className="text-xs font-semibold text-slate-400 hover:text-rose-500 px-3 py-1.5 rounded-full hover:bg-rose-50 flex-shrink-0">
                      Unfollow
                    </button>
                  </div>

                  {isEditing && (
                    <div className="mt-2 flex flex-wrap gap-1.5" style={{ animation: "seenFadeUp 200ms ease both" }}>
                      {FOLLOW_LABELS.map((l) => (
                        <button key={l} onClick={() => { onSetLabel?.(f.uid, l); setEditing(null); }}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-semibold border transition-colors ${
                            f.label === l ? "border-teal-400 bg-teal-50 text-teal-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                          }`}>
                          {l}
                        </button>
                      ))}
                      {customFor === f.uid ? (
                        <div className="flex items-center gap-1.5 w-full mt-1">
                          <input autoFocus value={customText} maxLength={20}
                            onChange={(e) => setCustomText(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") commitCustom(f.uid); }}
                            placeholder="Your own label…"
                            className="flex-1 rounded-full border border-slate-200 px-3 py-1 text-[12px] text-slate-800 focus:border-teal-400 focus:outline-none" />
                          <button onClick={() => commitCustom(f.uid)}
                            className="rounded-full bg-teal-600 px-3 py-1 text-[11px] font-bold text-white">Save</button>
                        </div>
                      ) : (
                        <button onClick={() => { setCustomFor(f.uid); setCustomText(f.label && !FOLLOW_LABELS.includes(f.label) ? f.label : ""); }}
                          className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 hover:bg-slate-50">
                          Custom…
                        </button>
                      )}
                      {f.label && (
                        <button onClick={() => { onSetLabel?.(f.uid, null); setEditing(null); }}
                          className="rounded-full px-2.5 py-1 text-[11px] font-semibold text-slate-400 hover:text-rose-500">
                          Remove label
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <p className="pt-3 text-center text-[10px] text-slate-400">Preview: your follows and labels stay on this device.</p>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Focused-feed section header — the boundary between strangers and your people ──
// Sticks to the top of the feed scroller so it stays visible while you scroll.
// `-mx-3.5 px-3.5` cancels the scroller's horizontal padding so the pinned bar runs edge
// to edge; `-top-2` with the matching `pt-3.5` cancels its `pt-2`, which would otherwise
// leave an 8px sliver above the bar for messages to scroll through.
export function FocusedFeedHeader({ count = 0, onManage }) {
  return (
    <div className="sticky -top-2 z-[25] -mx-3.5 mb-2 flex items-center gap-2 border-b border-slate-200 bg-slate-50/95 px-3.5 pb-1.5 pt-3.5 backdrop-blur">
      <p className="text-[11px] font-bold uppercase tracking-wide text-teal-600">👥 Focused Feed</p>
      <span className="text-[10px] font-semibold text-slate-400">
        {count === 0 ? "· just you for now" : `· ${count} ${count === 1 ? "person" : "people"} you follow`}
      </span>
      {onManage && (
        <button onClick={onManage}
          className="ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold text-teal-600 hover:bg-teal-50 transition-colors">
          Manage
        </button>
      )}
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

// ── "Who felt this" — who liked / replied to ONE of my messages ────────────────
// Opens only from the ❤️ badge on your own message, so it's private to you by
// construction. The likes are REAL Firestore data (publicMessages/{id}/reactions/❤️
// stores uids + countries + reactedAt and is world-readable); names are resolved from
// users/{uid}.fullName behind a cache. Private replies read the local store above.
const timeAgo = (ts) => {
  if (!ts) return "";
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days < 7 ? `${days}d ago` : new Date(ts).toLocaleDateString([], { day: "numeric", month: "short" });
};

export function MessageReactionsPanel({ db, message, onClose }) {
  const [reactors, setReactors] = useState(null); // null = loading
  const nameCache = useRef({});
  const replies = useMemo(() => loadRepliesReceived(message?.id), [message?.id]);

  useEffect(() => {
    if (!db || !message?.id) { setReactors([]); return; }
    let alive = true;
    const unsub = onSnapshot(collection(db, "publicMessages", message.id, "reactions"), async (snap) => {
      const rows = [];
      snap.forEach((d) => {
        const { uids = [], countries = {}, reactedAt = {} } = d.data() || {};
        uids.forEach((uid) => rows.push({ uid, emoji: d.id, country: countries[uid] ?? null, at: reactedAt[uid] ?? 0 }));
      });
      rows.sort((a, b) => (b.at || 0) - (a.at || 0));
      const resolved = await Promise.all(rows.map(async (r) => {
        if (nameCache.current[r.uid]) return { ...r, name: nameCache.current[r.uid] };
        try {
          const us = await getDoc(doc(db, "users", r.uid));
          const name = (us.data()?.fullName || "").trim() || "Someone";
          nameCache.current[r.uid] = name;
          return { ...r, name, country: r.country || us.data()?.country || null };
        } catch { return { ...r, name: "Someone" }; }
      }));
      if (alive) setReactors(resolved);
    }, () => { if (alive) setReactors([]); });
    return () => { alive = false; unsub(); };
  }, [db, message?.id]);

  return createPortal(
    <div data-portal className="fixed inset-0 z-[250] flex flex-col bg-white">
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 flex-shrink-0">
        <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
        <h2 className="flex-1 text-sm font-bold text-slate-800 flex items-center gap-1.5">
          <Heart size={15} className="text-rose-500" fill="currentColor" /> Who felt this
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto max-w-md space-y-5">
          <div className="rounded-2xl border border-teal-100 bg-teal-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-teal-600 mb-1">Your message</p>
            <p className="text-[15px] leading-relaxed text-slate-800 font-medium">“{message?.text}”</p>
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
              Hearts {reactors ? `· ${reactors.length}` : ""}
            </p>
            {reactors === null ? (
              <div className="py-8 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
                <Loader2 size={16} className="animate-spin" /> Loading…
              </div>
            ) : reactors.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 py-8 text-center text-[13px] text-slate-400">
                <div className="text-2xl mb-1">🤍</div>
                No hearts yet — they often arrive a little later.
              </div>
            ) : (
              <div className="space-y-1">
                {reactors.map((r) => (
                  <div key={`${r.uid}_${r.emoji}`} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white px-3 py-2.5">
                    <div className="h-9 w-9 rounded-xl bg-rose-50 flex items-center justify-center flex-shrink-0">
                      <span style={{ fontSize: "15px" }}>{flagFor(r.country)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">{r.name}</p>
                      {r.country && <p className="text-[11px] text-slate-400 truncate">{r.country}</p>}
                    </div>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">{timeAgo(r.at)}</span>
                    <span className="text-sm flex-shrink-0">{r.emoji}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-2">
              Private replies {replies.length ? `· ${replies.length}` : ""}
            </p>
            {replies.length === 0 ? (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-5 text-center text-[12px] text-slate-400 leading-relaxed">
                💬 Private replies to this message will appear here — only you can see them.
              </div>
            ) : (
              <div className="space-y-1">
                {replies.map((rep, i) => (
                  <div key={i} className="rounded-2xl border border-amber-100 bg-amber-50/60 px-3.5 py-2.5">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-sm">{flagFor(rep.country)}</span>
                      <span className="text-[11px] font-semibold text-slate-500 flex-1 truncate">{firstName(rep.name)}</span>
                      <span className="text-[10px] text-slate-400">{timeAgo(rep.ts)}</span>
                    </div>
                    <p className="text-[13px] text-slate-700 leading-snug">“{rep.text}”</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="pb-6 text-center text-[10px] text-slate-400">Only you can see who felt your message. 💛</p>
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
