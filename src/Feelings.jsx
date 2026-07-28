// Feelings.jsx — the Kindness Loop: see a real need → send easily → witness impact → pass it on.
//
// A user shares a short feeling (≤60 chars), public ("John 🇬🇧") or anonymous ("Someone from 🇬🇧").
// It broadcasts to the feed as a card in the FeelingsStrip for 24h. Others open the EncourageSheet:
// three AI-tailored suggestions (generated once at post time, stored on the doc) or a custom line
// that passes a live AI safety review. Replies are PRIVATE — delivered only to the poster
// (users/{poster}/feelingReplies); the strip shows just a "💛 N sent encouragement" counter.
// When the poster taps "This helped", every responder gets a kindness echo
// (users/{responder}/kindnessEchoes) + push — the "your words landed when they were needed" moment —
// and the poster is invited to encourage someone else (pass it forward).
//
// Data: feelings/{uid} (one active per user, id = poster uid, repost overwrites);
// users/{poster}/feelingReplies/{createdAt_responderUid}; users/{responder}/kindnessEchoes/{...}.
// Endpoints: /api/feeling-suggest (3 suggestions), /api/moderate-message (safety),
// /api/notify-feeling (push: reply → poster, ack → responders).

import React, { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  collection, query, orderBy, limit, onSnapshot, doc, setDoc, updateDoc,
  increment, runTransaction, arrayUnion,
} from "firebase/firestore";
import { X, Send, Heart, Loader2, PenLine, Check } from "lucide-react";
import { FLAG_MAP } from "./MicroAnimations";
import { apiUrl, authedPost } from "./apiBase";

export const FEELING_MAX_LEN = 60;
export const REPLY_MAX_LEN = 120;
export const FEELING_TTL_MS = 24 * 60 * 60 * 1000;
export const RESPONDER_REWARD = 10; // sparks for sending encouragement

// Keyed by the RESPONDER's uid too, so the "already sent" flag is per-account — switching
// accounts on the same device/browser must not carry another account's sent state over.
const repliedKey = (responderUid, posterUid, createdAt) => `seen_freply_${responderUid || "anon"}_${posterUid}_${createdAt}`;

function timeAgo(ms) {
  const m = Math.max(1, Math.round((Date.now() - ms) / 60000));
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
}

function flagOf(country) {
  return country && FLAG_MAP[country] ? FLAG_MAP[country] : "🌍";
}

function feelingLabel(f) {
  return f.visibility === "open"
    ? `${(f.posterName || "Someone").split(" ")[0]} ${flagOf(f.country)}`
    : `Someone from ${f.country ? `${flagOf(f.country)} ${f.country}` : "🌍 somewhere"}`;
}

// ── live feelings hook ───────────────────────────────────────────────────────────

export function useActiveFeelings(db, currentUser) {
  const uid = currentUser?.uid;
  const [all, setAll] = useState([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!db || !uid) return;
    const q = query(collection(db, "feelings"), orderBy("createdAt", "desc"), limit(30));
    return onSnapshot(q, (snap) => setAll(snap.docs.map((d) => d.data())), () => {});
  }, [db, uid]);

  // Minute ticker so expiry takes effect without a snapshot.
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60000);
    return () => clearInterval(t);
  }, []);

  return useMemo(() => {
    const now = Date.now();
    // A feeling stays live until it expires (24h) or the poster overwrites it — acknowledging
    // replies must NOT hide it, so anyone can keep encouraging the whole time.
    const live = all.filter((f) => f?.uid && (f.expiresAt ?? 0) > now);
    return {
      myFeeling: live.find((f) => f.uid === uid) ?? null,
      others: live.filter((f) => f.uid !== uid),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, uid, tick]);
}

// ── the strip (feed, directly under the tabs) ────────────────────────────────────
// A single, full-width ROTATING card cycling every 3s through the feelings other people have
// shared and could use encouragement on. Composing your own feeling now lives by the header name
// and in the profile, so this strip is purely "someone needs you right now" — and it hides itself
// entirely when nobody has shared, keeping the feed clean.

export function FeelingsStrip({ others, onEncourage, myUid, onOpenMine }) {
  const [idx, setIdx] = useState(0);

  // Rotate through the shared feelings (your own included), one at a time, every 3 seconds.
  useEffect(() => {
    if (others.length < 2) return;
    const t = setInterval(() => setIdx((i) => i + 1), 3000);
    return () => clearInterval(t);
  }, [others.length]);

  if (!others.length) return null;

  const current = others[idx % others.length];
  const mine = current.uid === myUid;
  const sent = mine ? false : (() => { try { return localStorage.getItem(repliedKey(myUid, current.uid, current.createdAt)) === "1"; } catch { return false; } })();

  return (
    <div className="border-b border-slate-100 bg-white px-3.5 py-1.5 flex-shrink-0">
      <button key={`${current.uid}_${current.createdAt}`} onClick={() => (mine ? onOpenMine?.() : (!sent && onEncourage(current)))}
        className="seen-feeling-strip w-full rounded-xl px-3 py-2 text-left active:scale-[0.99] transition-transform flex items-center gap-2"
        style={{
          background: mine ? "linear-gradient(135deg, #FFF6EF, #FFF1F0)" : "linear-gradient(135deg, #fffbeb, #fef3f2)",
          border: mine ? "1px solid #FFC4C0" : "1px solid #fde68a",
          animation: "seenFadeUp 400ms ease both",
        }}>
        <div className="flex-1 min-w-0">
          <p className={`text-[9px] font-bold uppercase tracking-wide truncate ${mine ? "text-emerald-600" : "text-amber-600"}`}>
            {mine ? "Your status" : feelingLabel(current)}
          </p>
          <p className="text-[12px] font-semibold text-slate-700 leading-tight truncate">“{current.text}”</p>
        </div>
        <span className={`flex-shrink-0 text-[11px] font-bold ${mine || sent ? "text-emerald-600" : "text-rose-500"}`}>
          {mine ? "💬 You" : sent ? "💛 Sent" : "💛 Encourage"}
        </span>
      </button>
    </div>
  );
}

// ── composer sheet ───────────────────────────────────────────────────────────────

export function FeelingComposer({ db, currentUser, profile, onClose }) {
  const [text, setText] = useState("");
  const [visibility, setVisibility] = useState("open");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const len = text.trim().length;

  const share = async () => {
    if (busy || !len) return;
    setBusy(true); setError("");
    const clean = text.trim().slice(0, FEELING_MAX_LEN);
    try {
      // Safety check — fail OPEN (an AI outage must never block sharing a feeling).
      try {
        const mod = await authedPost(currentUser, "/api/moderate-message", { text: clean, context: "feeling" });
        if (mod.checked && !mod.ok) {
          setError(mod.reason || "Let's keep it kind — try different words 💛");
          setBusy(false);
          return;
        }
      } catch (err) {
        // Fail OPEN by design (see above) — but say so, or a moderation outage means
        // feelings publish unscreened with nothing anywhere recording that it happened.
        console.error("[feelings] moderation unreachable — publishing unscreened:", err?.message);
      }

      // Tailored suggestions — generated once, stored on the doc for every viewer.
      let suggestions = [];
      try {
        const s = await authedPost(currentUser, "/api/feeling-suggest", { text: clean });
        if (Array.isArray(s.suggestions)) suggestions = s.suggestions.slice(0, 3);
      } catch { /* endpoint fallback missed too — sheet copes with empty */ }

      const now = Date.now();
      await setDoc(doc(db, "feelings", currentUser.uid), {
        uid: currentUser.uid,
        // Don't store the real name on an anonymous feeling — anon posts render as
        // "Someone from {country}", so the name must never be written to the doc.
        posterName: visibility === "anon" ? null : (profile?.fullName ?? "Someone"),
        country: profile?.country ?? null,
        text: clean,
        visibility,
        createdAt: now,
        expiresAt: now + FEELING_TTL_MS,
        suggestions,
        replyCount: 0,
        ackAt: null,
        ackedResponders: [], // uids the poster has thanked; reset each time the status changes
      });
      onClose();
    } catch (_) {
      setError("Couldn't share right now — please try again.");
    }
    setBusy(false);
  };

  return createPortal(
    <div data-portal className="fixed inset-0 z-[260] flex items-end justify-center sm:items-center"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl bg-white p-5 shadow-2xl"
        style={{ animation: "seenSheetRise 320ms cubic-bezier(0.34,1.56,0.64,1) both", paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-800">💭 How are you feeling?</h3>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-100"><X size={16} className="text-slate-500" /></button>
        </div>
        <p className="text-[11px] text-slate-500 leading-relaxed mb-2">
          A few honest words. People nearby and far away can send you encouragement — privately, just for you.
        </p>
        <input
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, FEELING_MAX_LEN))}
          autoFocus
          placeholder="e.g. Nervous — first day at a new job"
          className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-teal-400 focus:outline-none"
        />
        <div className="flex justify-end mt-1">
          <span className="text-[11px] font-semibold text-slate-400">{len}/{FEELING_MAX_LEN}</span>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <button onClick={() => setVisibility("open")}
            className={`rounded-2xl border px-3 py-2.5 text-left transition-colors ${visibility === "open" ? "border-teal-400 bg-teal-50" : "border-slate-200"}`}>
            <p className="text-[12px] font-bold text-slate-700">🙂 With my name</p>
            <p className="text-[10px] text-slate-500 leading-snug">
              “{(profile?.fullName || "You").split(" ")[0]} {flagOf(profile?.country)} is feeling…”
            </p>
          </button>
          <button onClick={() => setVisibility("anon")}
            className={`rounded-2xl border px-3 py-2.5 text-left transition-colors ${visibility === "anon" ? "border-teal-400 bg-teal-50" : "border-slate-200"}`}>
            <p className="text-[12px] font-bold text-slate-700">🕊️ Anonymous</p>
            <p className="text-[10px] text-slate-500 leading-snug">
              “Someone from {profile?.country ?? "somewhere"} is feeling…”
            </p>
          </button>
        </div>

        {error && <p className="text-xs font-semibold text-red-500 bg-red-50 rounded-xl px-3 py-2 mt-2">{error}</p>}

        <button onClick={share} disabled={busy || !len}
          className="mt-3 w-full rounded-full bg-teal-600 py-2.5 text-sm font-bold text-white hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
          {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={14} />} Share
        </button>
        <p className="mt-2 text-center text-[10px] text-slate-400">Visible for 24 hours · replies stay private to you</p>
        <p className="mt-1.5 text-center text-[10px] text-slate-400 leading-relaxed">
          Seen is a peer-support space, not a crisis or medical service. If you need urgent help, call
          999, Samaritans on 116 123, or text SHOUT to 85258.
        </p>
      </div>
    </div>,
    document.body
  );
}

// ── encourage sheet (the SEND step) ─────────────────────────────────────────────

export function EncourageSheet({ db, currentUser, profile, feeling, onClose }) {
  const [custom, setCustom] = useState(null); // null → suggestion mode; string → custom draft
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const send = async (replyText, source) => {
    if (busy) return;
    setBusy(true); setError("");
    const clean = replyText.trim().slice(0, REPLY_MAX_LEN);
    try {
      if (source === "custom") {
        // Custom text fails CLOSED — if the safety check can't run, we block and point
        // at the suggestions instead.
        let mod;
        try {
          mod = await authedPost(currentUser, "/api/moderate-message", { text: clean, context: "reply" });
        } catch {
          setError("We couldn't check that just now — try one of the suggestions 💛");
          setBusy(false); return;
        }
        if (!mod.checked) {
          setError("We couldn't check that just now — try one of the suggestions 💛");
          setBusy(false); return;
        }
        if (!mod.ok) {
          setError(mod.reason || "Let's keep it kind — try different words 💛");
          setBusy(false); return;
        }
      }

      try {
        await setDoc(doc(db, "users", feeling.uid, "feelingReplies", `${feeling.createdAt}_${currentUser.uid}`), {
          feelingUid: feeling.uid,
          feelingCreatedAt: feeling.createdAt,
          feelingText: feeling.text,
          responderUid: currentUser.uid,
          responderName: profile?.fullName ?? "Someone",
          responderCountry: profile?.country ?? null,
          text: clean,
          source,
          createdAt: Date.now(),
        });
      } catch (e) {
        // Deterministic id = one reply per responder. A denied write here means we've already
        // encouraged this person (e.g. the local "sent" flag was cleared by an app reinstall) —
        // treat it as done, not a scary failure, and don't double-count.
        if (e?.code === "permission-denied") {
          try { localStorage.setItem(repliedKey(currentUser.uid, feeling.uid, feeling.createdAt), "1"); } catch { /* ignore */ }
          setError("You've already sent this person encouragement 💛");
          setBusy(false);
          return;
        }
        throw e;
      }
      try { localStorage.setItem(repliedKey(currentUser.uid, feeling.uid, feeling.createdAt), "1"); } catch { /* ignore */ }
      updateDoc(doc(db, "feelings", feeling.uid), { replyCount: increment(1) }).catch(() => {});

      // Spark reward for showing up in someone's hard moment.
      runTransaction(db, async (tx) => {
        const refDoc = doc(db, "users", currentUser.uid);
        const snap = await tx.get(refDoc);
        const bal = Number(snap.exists() ? snap.data().sparkBalance ?? 0 : 0);
        tx.set(refDoc, { sparkBalance: bal + RESPONDER_REWARD }, { merge: true });
      }).catch(() => {});

      authedPost(currentUser, "/api/notify-feeling", { type: "reply", posterUid: feeling.uid }).catch(() => {});
      setDone(true);
    } catch (_) {
      setError("Couldn't send — please try again.");
    }
    setBusy(false);
  };

  const suggestions = Array.isArray(feeling.suggestions) ? feeling.suggestions.filter(Boolean) : [];

  return createPortal(
    <div data-portal className="fixed inset-0 z-[260] flex items-end justify-center sm:items-center"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl bg-white p-5 shadow-2xl"
        style={{ animation: "seenSheetRise 320ms cubic-bezier(0.34,1.56,0.64,1) both", paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
            <Heart size={15} className="text-rose-500" /> Send encouragement
          </h3>
          <button onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-100"><X size={16} className="text-slate-500" /></button>
        </div>

        <div className="rounded-2xl bg-amber-50 border border-amber-100 px-3 py-2.5 mb-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600">{feelingLabel(feeling)} · {timeAgo(feeling.createdAt)}</p>
          <p className="text-[13px] font-semibold text-slate-700 leading-snug mt-0.5">“{feeling.text}”</p>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-2 py-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-100"><Heart size={20} className="text-rose-500" /></div>
            <p className="text-sm font-bold text-slate-800">Your encouragement is on its way 💛</p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Delivered privately, right when it's needed. <strong>+{RESPONDER_REWARD} drops.</strong><br />
              If it helped them, you'll hear about it ✨
            </p>
            <button onClick={onClose}
              className="mt-2 rounded-full bg-teal-600 px-6 py-2 text-sm font-semibold text-white hover:bg-teal-700">Done</button>
          </div>
        ) : custom === null ? (
          <>
            <p className="text-[11px] text-slate-500 mb-2">Tap one to send it — written for this moment:</p>
            <div className="space-y-2">
              {(suggestions.length ? suggestions : [
                "Whatever today holds, someone out here is rooting for you 💛",
                "You've made it through every hard day so far — that's a 100% record ✨",
                "Sending you a little strength from across the world 🌍",
              ]).map((s, i) => (
                <button key={i} onClick={() => send(s, "suggested")} disabled={busy}
                  className="w-full rounded-2xl border border-teal-100 bg-teal-50/60 px-3 py-2.5 text-left text-[13px] font-medium text-slate-700 leading-snug hover:bg-teal-50 active:scale-[0.99] transition-all disabled:opacity-50">
                  {s}
                </button>
              ))}
            </div>
            <button onClick={() => setCustom("")}
              className="mt-3 w-full rounded-full border border-slate-200 py-2 text-[12px] font-semibold text-slate-500 hover:bg-slate-50 flex items-center justify-center gap-1.5">
              <PenLine size={13} /> Write your own
            </button>
          </>
        ) : (
          <>
            <textarea
              value={custom}
              onChange={(e) => setCustom(e.target.value.slice(0, REPLY_MAX_LEN))}
              rows={3} autoFocus
              placeholder="Your own words of encouragement…"
              className="w-full resize-none rounded-2xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 focus:border-teal-400 focus:outline-none"
            />
            <div className="flex items-center justify-between mt-1">
              <button onClick={() => { setCustom(null); setError(""); }} className="text-[11px] font-semibold text-slate-400 hover:text-slate-600">← Suggestions</button>
              <span className="text-[11px] font-semibold text-slate-400">{custom.trim().length}/{REPLY_MAX_LEN}</span>
            </div>
            {error && <p className="text-xs font-semibold text-red-500 bg-red-50 rounded-xl px-3 py-2 mt-2">{error}</p>}
            <button onClick={() => send(custom, "custom")} disabled={busy || !custom.trim()}
              className="mt-2 w-full rounded-full bg-teal-600 py-2.5 text-sm font-bold text-white hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-2">
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Send size={14} />} Send kindly
            </button>
            <p className="mt-1.5 text-center text-[10px] text-slate-400">Checked for kindness before it's sent</p>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

// ── the poster's replies panel + acknowledgement + pass-it-forward ──────────────

export function MyFeelingPanel({ db, currentUser, feeling, othersFeelings, onClose, onEncourage }) {
  const [replies, setReplies] = useState([]);
  const [ackedResponders, setAckedResponders] = useState(feeling.ackedResponders ?? []);
  const [busy, setBusy] = useState(false);
  const [showPassForward, setShowPassForward] = useState(false);

  // Live replies to THIS feeling.
  useEffect(() => {
    if (!db || !currentUser?.uid) return;
    const q = query(collection(db, "users", currentUser.uid, "feelingReplies"), orderBy("createdAt", "desc"), limit(50));
    return onSnapshot(q, (snap) => {
      setReplies(snap.docs.map((d) => d.data()).filter((r) => r.feelingCreatedAt === feeling.createdAt));
    }, () => {});
  }, [db, currentUser?.uid, feeling.createdAt]);

  // Live feeling doc → keep the thanked-list fresh (survives panel reopen, other-device acks).
  useEffect(() => {
    if (!db || !currentUser?.uid) return;
    return onSnapshot(doc(db, "feelings", currentUser.uid), (snap) => {
      const d = snap.data();
      if (d && d.createdAt === feeling.createdAt) setAckedResponders(d.ackedResponders ?? []);
    }, () => {});
  }, [db, currentUser?.uid, feeling.createdAt]);

  const ackedSet = useMemo(() => new Set(ackedResponders), [ackedResponders]);
  const pendingUids = useMemo(
    () => [...new Set(replies.map((r) => r.responderUid).filter((u) => u && !ackedSet.has(u)))],
    [replies, ackedSet]
  );

  const thankAll = async () => {
    if (busy || !pendingUids.length) return;
    setBusy(true);
    try {
      // One echo per newly-thanked responder — "your words helped, right when they were needed".
      await Promise.all(pendingUids.map((rUid) =>
        setDoc(doc(db, "users", rUid, "kindnessEchoes", `${feeling.createdAt}_${currentUser.uid}`), {
          fromUid: currentUser.uid,
          ownerUid: rUid,
          feelingText: feeling.text,
          posterName: feeling.visibility === "open" ? feeling.posterName : null,
          posterCountry: feeling.country ?? null,
          createdAt: Date.now(),
        }).catch(() => {})
      ));
      // Non-destructive: record who's been thanked; the feeling stays live for more encouragement.
      await updateDoc(doc(db, "feelings", currentUser.uid), {
        ackedResponders: arrayUnion(...pendingUids),
        ackAt: Date.now(),
      }).catch(() => {});
      setAckedResponders((prev) => [...new Set([...prev, ...pendingUids])]);
      authedPost(currentUser, "/api/notify-feeling", { type: "ack", responderUids: pendingUids }).catch(() => {});
      setShowPassForward(true);
    } catch (_) { /* leave panel open; user can retry */ }
    setBusy(false);
  };

  // Pass-it-forward: the oldest least-answered live feeling from someone else.
  const passTarget = useMemo(() => {
    const candidates = (othersFeelings || []).filter((f) => {
      try { return localStorage.getItem(repliedKey(currentUser?.uid, f.uid, f.createdAt)) !== "1"; } catch { return true; }
    });
    return candidates.sort((a, b) => (a.replyCount ?? 0) - (b.replyCount ?? 0) || a.createdAt - b.createdAt)[0] ?? null;
  }, [othersFeelings]);

  const thankedCount = replies.filter((r) => ackedSet.has(r.responderUid)).length;

  return createPortal(
    <div data-portal className="fixed inset-0 z-[260] flex items-end justify-center sm:items-center"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }} onClick={onClose}>
      <div className="w-full max-w-sm rounded-t-3xl sm:rounded-3xl bg-white p-5 shadow-2xl max-h-[85vh] overflow-y-auto"
        style={{ animation: "seenSheetRise 320ms cubic-bezier(0.34,1.56,0.64,1) both", paddingBottom: "max(20px, env(safe-area-inset-bottom))" }}
        onClick={(e) => e.stopPropagation()}>
          <>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold text-slate-800">💛 Kind words for you</h3>
              <button onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-100"><X size={16} className="text-slate-500" /></button>
            </div>
            <div className="rounded-2xl bg-teal-50 border border-teal-100 px-3 py-2 mb-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-teal-600">
                You shared · {timeAgo(feeling.createdAt)} · stays for 24h
              </p>
              <p className="text-[13px] font-semibold text-slate-700 leading-snug">“{feeling.text}”</p>
            </div>

            {replies.length === 0 ? (
              <p className="py-6 text-center text-[12px] text-slate-400">
                Your feeling is out there 🌍<br />Kind words usually arrive within the hour.
              </p>
            ) : (
              <div className="space-y-2">
                {replies.map((r) => {
                  const thanked = ackedSet.has(r.responderUid);
                  return (
                    <div key={`${r.responderUid}_${r.createdAt}`}
                      className={`rounded-2xl border px-3 py-2.5 ${thanked ? "border-emerald-100 bg-emerald-50/60" : "border-slate-100 bg-slate-50/60"}`}
                      style={{ animation: "seenFadeUp 300ms ease both" }}>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold text-slate-400">
                          {(r.responderName || "Someone").split(" ")[0]} {flagOf(r.responderCountry)} · {timeAgo(r.createdAt)}
                        </p>
                        {thanked && (
                          <span className="flex items-center gap-0.5 text-[9px] font-bold text-emerald-600">
                            <Check size={10} /> Thanked
                          </span>
                        )}
                      </div>
                      <p className="text-[13px] text-slate-700 leading-snug mt-0.5">{r.text}</p>
                    </div>
                  );
                })}
              </div>
            )}

            {replies.length > 0 && (
              <>
                {pendingUids.length > 0 ? (
                  <button onClick={thankAll} disabled={busy}
                    className="mt-4 w-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 py-2.5 text-sm font-bold text-white active:scale-[0.98] transition-transform disabled:opacity-50 flex items-center justify-center gap-2">
                    {busy ? <Loader2 size={15} className="animate-spin" /> : "💛"}
                    {thankedCount > 0 ? `Thank ${pendingUids.length} new` : "This helped — thank them all"}
                  </button>
                ) : (
                  <div className="mt-4 w-full rounded-full bg-emerald-50 border border-emerald-100 py-2.5 text-center text-sm font-bold text-emerald-600 flex items-center justify-center gap-1.5">
                    <Check size={15} /> All thanked
                  </div>
                )}
                <p className="mt-1.5 text-center text-[10px] text-slate-400">
                  Everyone you thank hears their words landed · your status stays live for more kindness
                </p>
              </>
            )}

            {/* Optional, non-blocking: pass the warmth on after thanking */}
            {showPassForward && passTarget && (
              <button onClick={() => { onClose(); onEncourage(passTarget); }}
                className="mt-3 w-full rounded-2xl px-3 py-2.5 text-left active:scale-[0.99] transition-transform"
                style={{ background: "linear-gradient(135deg, #fffbeb, #fef3f2)", border: "1px solid #fde68a" }}>
                <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600">🌱 Pass it forward · {feelingLabel(passTarget)}</p>
                <p className="text-[12px] font-semibold text-slate-700 leading-snug mt-0.5 truncate">“{passTarget.text}”</p>
                <p className="text-[11px] font-bold text-rose-500 mt-0.5">💛 Encourage them →</p>
              </button>
            )}
          </>
      </div>
    </div>,
    document.body
  );
}

// ── toast hooks for App.jsx (fresh replies + echoes) ─────────────────────────────

const FRESH_MS = 30 * 60 * 1000; // mirror TOAST_AGE_LIMIT_MS — old events land in the bell, not a toast

export function useFeelingToasts(db, currentUser, onReply, onEcho) {
  const uid = currentUser?.uid;
  const seenRef = useRef(new Set());

  useEffect(() => {
    if (!db || !uid) return;
    const q = query(collection(db, "users", uid, "feelingReplies"), orderBy("createdAt", "desc"), limit(10));
    return onSnapshot(q, (snap) => {
      snap.docChanges().forEach((ch) => {
        if (ch.type !== "added") return;
        const d = ch.doc.data();
        const key = `r_${d.responderUid}_${d.createdAt}`;
        if (seenRef.current.has(key)) return;
        seenRef.current.add(key);
        if (Date.now() - (d.createdAt ?? 0) < FRESH_MS) onReply?.(d);
      });
    }, () => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, uid]);

  useEffect(() => {
    if (!db || !uid) return;
    const q = query(collection(db, "users", uid, "kindnessEchoes"), orderBy("createdAt", "desc"), limit(10));
    return onSnapshot(q, (snap) => {
      snap.docChanges().forEach((ch) => {
        if (ch.type !== "added") return;
        const d = ch.doc.data();
        const key = `e_${d.fromUid}_${d.createdAt}`;
        if (seenRef.current.has(key)) return;
        seenRef.current.add(key);
        if (Date.now() - (d.createdAt ?? 0) < FRESH_MS) onEcho?.(d);
      });
    }, () => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, uid]);
}
