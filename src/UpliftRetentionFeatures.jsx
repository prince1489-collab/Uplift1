// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import {
  collection, deleteDoc, doc, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, setDoc, updateDoc, where, arrayUnion, arrayRemove, addDoc, increment,
} from "firebase/firestore";

import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

import { startCheckout } from "./payments";
import { StickerPicker, STICKERS } from "./StickerReactions";
import { HEART, announceReaction, setMyReaction } from "./reactions";
import { authedPost } from "./apiBase";
import { prepareImage, PREPARED_TYPE } from "./imagePrep";
import { POINTS } from "./points";
import { GlimpseChips, MOST_DAYS_EXAMPLES, ANOTHER_LIFE_EXAMPLES } from "./glimpseExamples";
import { syncPublicProfile, readPublicProfile } from "./publicProfile";

import {
  Bell,
  Camera,
  CheckCircle2,
  ChevronRight,
  Flame,
  Gift,
  Heart,
  MapPin,
  Pencil,
  Plus,
  Share2,
  Shield,
  Sparkles,
  Star,
  Users,
  X,
} from "lucide-react";

// ─────────────────────────────────────────────────────────────────
// 0. SHARED HELPERS
// ─────────────────────────────────────────────────────────────────

const COUNTRY_OPTIONS = [
  "Afghanistan","Albania","Algeria","Andorra","Angola","Antigua and Barbuda","Argentina","Armenia","Australia","Austria",
  "Azerbaijan","Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan","Bolivia",
  "Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi","Cabo Verde","Cambodia",
  "Cameroon","Canada","Central African Republic","Chad","Chile","China","Colombia","Comoros","Congo","Costa Rica",
  "Croatia","Cuba","Cyprus","Czech Republic","Democratic Republic of the Congo","Denmark","Djibouti","Dominica",
  "Dominican Republic","Ecuador","Egypt","El Salvador","Equatorial Guinea","Eritrea","Estonia","Eswatini","Ethiopia",
  "Fiji","Finland","France","Gabon","Gambia","Georgia","Germany","Ghana","Greece","Grenada","Guatemala","Guinea",
  "Guinea-Bissau","Guyana","Haiti","Honduras","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel",
  "Italy","Ivory Coast","Jamaica","Japan","Jordan","Kazakhstan","Kenya","Kiribati","Kuwait","Kyrgyzstan","Laos",
  "Latvia","Lebanon","Lesotho","Liberia","Libya","Liechtenstein","Lithuania","Luxembourg","Madagascar","Malawi",
  "Malaysia","Maldives","Mali","Malta","Marshall Islands","Mauritania","Mauritius","Mexico","Micronesia","Moldova",
  "Monaco","Mongolia","Montenegro","Morocco","Mozambique","Myanmar","Namibia","Nauru","Nepal","Netherlands",
  "New Zealand","Nicaragua","Niger","Nigeria","North Korea","North Macedonia","Norway","Oman","Pakistan","Palau",
  "Palestine","Panama","Papua New Guinea","Paraguay","Peru","Philippines","Poland","Portugal","Qatar","Romania",
  "Russia","Rwanda","Saint Kitts and Nevis","Saint Lucia","Saint Vincent and the Grenadines","Samoa","San Marino",
  "Sao Tome and Principe","Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia",
  "Slovenia","Solomon Islands","Somalia","South Africa","South Korea","South Sudan","Spain","Sri Lanka","Sudan",
  "Suriname","Sweden","Switzerland","Syria","Taiwan","Tajikistan","Tanzania","Thailand","Timor-Leste","Togo",
  "Tonga","Trinidad and Tobago","Tunisia","Turkey","Turkmenistan","Tuvalu","Uganda","Ukraine","United Arab Emirates",
  "United Kingdom","United States","Uruguay","Uzbekistan","Vanuatu","Vatican City","Venezuela","Vietnam","Yemen",
  "Zambia","Zimbabwe",
];

export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export const MYSTERY_POOL = [
  { id: "m1", label: "Double Joy",     sparkReward: 50, emoji: "✨" },
  { id: "m2", label: "Kind Surge",     sparkReward: 40, emoji: "💛" },
  { id: "m3", label: "Sunshine Burst", sparkReward: 35, emoji: "☀️" },
  { id: "m4", label: "Midnight Magic", sparkReward: 45, emoji: "🌙" },
];

function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

export function thisWeeksMystery() {
  return MYSTERY_POOL[isoWeek() % MYSTERY_POOL.length];
}

// What the Kindness Tree will ACTUALLY gain from an action: the Firestore reward
// (streak-multiplied) plus the device-local tree points awarded alongside it.
//
// The picker used to advertise only the first half, so sending a greeting read "+20" while
// the tree moved by 120 — and Practice separately advertised "+150 drops" for ticking a
// box, making a checkbox look worth seven greetings. Both halves are drops in the same
// tree; showing the sum is simply the honest number, and needs no fudge factor to keep in
// step with either ledger.
// Report + block for the UGC surfaces that aren't the message action bar — shared
// reflections and received private replies. Play expects reporting and blocking on EVERY
// user-generated surface, and until now only feed messages had either.
//
// Deliberately its own component rather than a refactor of QuickReactBar: that bar is the
// main message action row (reactions, gifts, waves, replies) and is well exercised. The
// handlers below mirror its fixed behaviour — await the write, confirm only on success,
// surface the failure — rather than optimistically claiming it worked.
export function ReportBlockBar({ db, currentUser, targetUid, targetName, contentId, contentKind }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null); // "reported" | "blocked"
  const [error, setError] = useState("");
  const isOther = targetUid && currentUser?.uid && targetUid !== currentUser.uid;
  if (!isOther || !db) return null;

  const report = async (reason) => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await addDoc(collection(db, "reports"), {
        kind: contentKind,          // "reflection" | "reply" — the admin queue needs to know
        contentId: contentId ?? null,
        messageId: contentKind === "message" ? contentId ?? null : null, // legacy field
        reporterUid: currentUser.uid,
        reportedUid: targetUid,
        reason,
        status: "open",
        timestamp: Date.now(),
      });
      setDone("reported");
    } catch {
      setError("Couldn't send that report — check your connection and try again.");
    }
    setBusy(false);
  };

  const block = async () => {
    if (busy) return;
    setBusy(true); setError("");
    try {
      await setDoc(doc(db, "users", currentUser.uid, "blockedUsers", targetUid), {
        name: targetName ?? "Someone",
        blockedAt: Date.now(),
      });
      setDone("blocked");
    } catch {
      setError("Couldn't block them — check your connection and try again.");
    }
    setBusy(false);
  };

  if (done) {
    return (
      <p className="text-[11px] font-semibold text-teal-600">
        {done === "reported" ? "Reported — thank you. We'll review it." : `Blocked. You won't see ${targetName ?? "them"} again.`}
      </p>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="text-[11px] font-semibold text-slate-400 hover:text-rose-500 transition-colors">
        Report or block
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-2 space-y-1.5">
      {error && <p className="text-[11px] font-semibold text-rose-600" role="alert">{error}</p>}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Report:</span>
        {["Harmful", "Spam", "Inappropriate", "Other"].map((r) => (
          <button key={r} onClick={() => report(r)} disabled={busy}
            className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50">
            {r}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <button onClick={block} disabled={busy}
          className="rounded-full px-2 py-1 text-[11px] font-bold text-rose-600 hover:bg-rose-50 disabled:opacity-50">
          🚫 Block {targetName ?? "them"}
        </button>
        <button onClick={() => setOpen(false)} className="ml-auto text-[11px] font-semibold text-slate-400">Cancel</button>
      </div>
    </div>
  );
}

export function computeDropsGain(baseReward, streakDays = 0, action = "send") {
  return computeSparkReward(baseReward, streakDays) + (POINTS[action] ?? 0);
}

export function computeSparkReward(baseReward, streakDays = 0) {
  const multiplier =
    streakDays >= 30 ? 2.0 :
    streakDays >= 14 ? 1.75 :
    streakDays >= 7  ? 1.5 :
    streakDays >= 3  ? 1.25 : 1.0;
  return Math.round(baseReward * multiplier);
}

// ─────────────────────────────────────────────────────────────────
// 1. STREAK SYSTEM
// ─────────────────────────────────────────────────────────────────

const FREEZE_COST = 10;

export function useStreak(db, uid, profile) {
  const [streak, setStreak] = useState(0);
  const [freezesAvailable, setFreezesAvailable] = useState(0);

  useEffect(() => {
    if (!profile) return;
    setStreak(Number(profile.streakDays ?? 0));
    setFreezesAvailable(Number(profile.streakFreezes ?? 0));
  }, [profile]);

  const recordGreetingDay = useCallback(async () => {
    if (!db || !uid) return;
    const today = todayKey();
    const userRef = doc(db, "users", uid);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(userRef);
      const data = snap.exists() ? snap.data() : {};
      const lastDate = data.lastGreetingDate ?? "";
      const currentStreak = Number(data.streakDays ?? 0);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yKey = yesterday.toISOString().slice(0, 10);
      let newStreak = 1;
      if (lastDate === today) newStreak = currentStreak;
      else if (lastDate === yKey) newStreak = currentStreak + 1;
      tx.set(userRef, { streakDays: newStreak, lastGreetingDate: today }, { merge: true });
    });
  }, [db, uid]);

  const buyFreeze = useCallback(async () => {
    if (!db || !uid) return { error: "Not signed in." };
    const userRef = doc(db, "users", uid);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(userRef);
        const data = snap.exists() ? snap.data() : {};
        const balance = Number(data.sparkBalance ?? 0);
        if (balance < FREEZE_COST) throw new Error("insufficient_sparks");
        tx.set(userRef, { sparkBalance: balance - FREEZE_COST, streakFreezes: Number(data.streakFreezes ?? 0) + 1 }, { merge: true });
      });
      return { ok: true };
    } catch (e) {
      return { error: e.message === "insufficient_sparks" ? "Not enough drops." : "Failed." };
    }
  }, [db, uid]);

  const useFreeze = useCallback(async () => {
    if (!db || !uid) return { error: "Not signed in." };
    const userRef = doc(db, "users", uid);
    const today = todayKey();
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(userRef);
        const data = snap.exists() ? snap.data() : {};
        const freezes = Number(data.streakFreezes ?? 0);
        if (freezes < 1) throw new Error("no_freezes");
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yKey = yesterday.toISOString().slice(0, 10);
        tx.set(userRef, { streakFreezes: freezes - 1, lastGreetingDate: yKey, lastFreezeUsed: today }, { merge: true });
      });
      return { ok: true };
    } catch (e) {
      return { error: e.message === "no_freezes" ? "No freezes left." : "Failed." };
    }
  }, [db, uid]);

  const sellFreeze = useCallback(async () => {
    if (!db || !uid) return { error: "Not signed in." };
    const userRef = doc(db, "users", uid);
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(userRef);
        const data = snap.exists() ? snap.data() : {};
        const freezes = Number(data.streakFreezes ?? 0);
        if (freezes < 1) throw new Error("no_freezes");
        const balance = Number(data.sparkBalance ?? 0);
        tx.set(userRef, {
          streakFreezes: freezes - 1,
          sparkBalance: balance + FREEZE_COST,
        }, { merge: true });
      });
      return { ok: true };
    } catch (e) {
      return { error: "No freezes to refund." };
    }
  }, [db, uid]);

  return { streak, freezesAvailable, recordGreetingDay, buyFreeze, useFreeze, sellFreeze };
}

export function StreakBadge({ streak }) {
  if (!streak || streak < 1) return null;
  const hot = streak >= 7;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold border${
      hot ? " seen-shimmer bg-amber-50 border-amber-300 text-amber-700" : " bg-slate-50 border-slate-200 text-slate-600"
    }`}>
      <Flame size={12} className={hot ? "text-amber-500" : "text-slate-400"} />
      {streak}d
    </span>
  );
}

export function StreakFreezeButton({ freezes, sparkBalance, onBuy, onSell }) {
  const canAfford = sparkBalance >= FREEZE_COST;
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div className="relative flex-shrink-0" ref={ref}>
      <button type="button" onClick={() => freezes > 0 ? setOpen(v => !v) : onBuy?.()}
        disabled={!canAfford && freezes === 0}
        title={freezes > 0 ? "Click to manage" : canAfford ? `Buy freeze for ${FREEZE_COST} drops` : "Not enough drops"}
        className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
          freezes > 0 ? "border-cyan-200 bg-cyan-50 text-cyan-700 hover:border-cyan-300"
          : canAfford ? "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
          : "border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed"
        }`}>
        <Shield size={11} />
        {freezes > 0 ? `${freezes} ❄️ freeze${freezes > 1 ? "s" : ""}` : `Freeze (${FREEZE_COST}💧)`}
      </button>

      {/* Dropdown for freeze management */}
      {open && freezes > 0 && (
        <div className="absolute right-0 bottom-full mb-2 z-50 w-56 rounded-2xl border border-slate-100 bg-white py-2 shadow-xl">
          <p className="px-3 pb-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">❄️ Streak Freeze</p>
          <p className="px-3 pb-2 text-[11px] text-slate-500 leading-relaxed">
            You have <span className="font-semibold text-cyan-600">{freezes} freeze{freezes > 1 ? "s" : ""}</span>.
            Miss a day and a freeze will automatically protect your streak.
          </p>
          <div className="border-t border-slate-100 pt-1">
            <button onClick={() => { onBuy?.(); setOpen(false); }} disabled={!canAfford}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-slate-700 hover:bg-slate-50 disabled:opacity-40">
              <span>➕</span> Buy another ({FREEZE_COST}💧)
            </button>
            <button onClick={() => { onSell?.(); setOpen(false); }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-red-500 hover:bg-red-50">
              <span>↩️</span> Undo — refund {FREEZE_COST}💧
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// 2. KINDNESS PLEDGE
// ─────────────────────────────────────────────────────────────────

export function KindnessPledge({ db, uid, todayMessageCount = 0 }) {
  const [target, setTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  const pledgeRef = useMemo(
    () => (db && uid ? doc(db, "users", uid, "pledges", todayKey()) : null),
    [db, uid]
  );

  useEffect(() => {
    if (!pledgeRef) return;
    const unsub = onSnapshot(pledgeRef, (snap) => {
      setTarget(snap.exists() ? snap.data().target ?? null : null);
      setLoading(false);
    });
    return unsub;
  }, [pledgeRef]);

  const savePledge = async (n) => {
    if (!pledgeRef) return;
    setSaving(true);
    try {
      await setDoc(pledgeRef, { target: n, createdAt: serverTimestamp() });
      setTarget(n); setPicking(false);
    } finally { setSaving(false); }
  };

  if (loading) return null;
  const fulfilled = target !== null && todayMessageCount >= target;
  const remaining = target !== null ? Math.max(0, target - todayMessageCount) : null;

  if (target === null && !picking) {
    return (
      <button onClick={() => setPicking(true)}
        className="flex w-full items-center gap-2 rounded-2xl border border-dashed border-teal-300 bg-teal-50/60 px-4 py-2.5 text-sm text-teal-700 hover:bg-teal-50 transition-colors">
        <CheckCircle2 size={14} className="text-teal-500" />
        Set today's kindness pledge
      </button>
    );
  }

  if (picking) {
    return (
      <div className="rounded-2xl border border-teal-200 bg-teal-50/60 px-4 py-3">
        <p className="mb-2 text-xs font-semibold text-teal-800">How many greetings will you send today?</p>
        <div className="flex gap-2">
          {[1, 3, 5, 10].map((n) => (
            <button key={n} disabled={saving} onClick={() => savePledge(n)}
              className="flex-1 rounded-xl border border-teal-300 bg-white py-2 text-sm font-bold text-teal-700 hover:bg-teal-100 transition-colors">
              {n}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center rounded-2xl border px-4 py-2.5 text-sm ${
      fulfilled ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"
    }`}>
      <CheckCircle2 size={14} className={`mr-2 ${fulfilled ? "text-emerald-500" : "text-amber-500"}`} />
      {fulfilled
        ? `Pledge complete! ${todayMessageCount}/${target} greetings ✨`
        : `Pledge: ${todayMessageCount}/${target} — ${remaining} to go`}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// 3. BUDDIES + SPARK GIFTING
// ─────────────────────────────────────────────────────────────────

const GIFT_AMOUNT = 5;

export function BuddyPanel({ db, currentUser, profile, compact = false, onChatOpen }) {
  const [buddyProfiles, setBuddyProfiles] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [inviteInput, setInviteInput] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);
  const [copied, setCopied] = useState(false);
  const buddyUids = profile?.buddies ?? [];

  const inviteLink = currentUser ? window.location.origin + "?add=" + currentUser.uid : "";

  useEffect(() => {
    if (!db || buddyUids.length === 0) { setBuddyProfiles([]); return; }
    Promise.all(buddyUids.slice(0, 5).map((uid) => readPublicProfile(db, uid).then((p) => (p ? { uid, ...p } : null))))
      .then((rows) => setBuddyProfiles(rows.filter(Boolean)));
  }, [db, JSON.stringify(buddyUids)]);

  const handleShareInvite = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: "Join me on Seen", url: inviteLink }); } catch {}
    } else {
      await navigator.clipboard.writeText(inviteLink).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const lookupByInput = async () => {
    if (!db || !inviteInput.trim()) return;
    setSearching(true); setSearchError(""); setSearchResult(null);
    try {
      const extractedUid = inviteInput.includes("?add=")
        ? inviteInput.split("?add=")[1].split("&")[0]
        : inviteInput.trim();
      const pub = await readPublicProfile(db, extractedUid);
      if (!pub) setSearchError("No user found.");
      else setSearchResult({ uid: extractedUid, ...pub });
    } catch { setSearchError("Lookup failed."); }
    finally { setSearching(false); }
  };

  const addBuddy = async (targetUid) => {
    if (!db || !currentUser) return;
    await updateDoc(doc(db, "users", currentUser.uid), { buddies: arrayUnion(targetUid) });
    setAddOpen(false); setSearchResult(null); setInviteInput("");
  };

  const removeBuddy = async (targetUid) => {
    if (!db || !currentUser) return;
    await updateDoc(doc(db, "users", currentUser.uid), { buddies: arrayRemove(targetUid) });
  };

  // Compact mode: smaller, no outer card styling (used inside meatball dropdown)
  if (compact) return (
    <div className="py-0.5">
      {buddyProfiles.length === 0 && !addOpen && (
        <p className="text-[10px] text-slate-400 px-1 pb-1">No buddies yet.</p>
      )}
      <div className="space-y-1">
        {buddyProfiles.map((b) => (
          <div key={b.uid} className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              {b.profilePhotoUrl
                ? <img src={b.profilePhotoUrl} alt="" className="h-5 w-5 rounded-full object-cover" />
                : <div className="h-5 w-5 rounded-full bg-teal-100 flex items-center justify-center text-[9px] font-bold text-teal-700">{(b.fullName ?? "?")[0]}</div>}
              <span className="text-[11px] text-slate-700">{b.fullName}</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => removeBuddy(b.uid)} className="text-slate-300 hover:text-rose-400"><X size={10} /></button>
            </div>
          </div>
        ))}
      </div>
      {buddyUids.length < 5 && !addOpen && (
        <button onClick={() => setAddOpen(true)}
          className="mt-1 w-full rounded-lg border border-dashed border-slate-200 py-1 text-[10px] text-slate-400 hover:border-teal-300 hover:text-teal-500 transition-colors">
          + Add buddy
        </button>
      )}
      {addOpen && (
        <div className="mt-1 space-y-1">
          <button onClick={handleShareInvite}
            className="w-full rounded-lg border border-teal-200 bg-teal-50 py-1 text-[11px] font-semibold text-teal-700 hover:bg-teal-100 transition-colors">
            {copied ? "Copied!" : "Share invite"}
          </button>
          <input value={inviteInput} onChange={(e) => setInviteInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookupByInput()}
            placeholder="Paste invite link or code…"
            className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px]" />
          <button onClick={lookupByInput} disabled={searching}
            className="w-full rounded-lg bg-teal-600 py-1 text-[11px] font-semibold text-white">
            {searching ? "…" : "Search"}
          </button>
          {searchError && <p className="text-[10px] text-rose-500">{searchError}</p>}
          {searchResult && searchResult.uid !== currentUser?.uid && (
            <div className="flex items-center justify-between rounded-lg border border-teal-200 bg-white px-2 py-1">
              <span className="text-[11px] text-slate-700">{searchResult.fullName}</span>
              <button onClick={() => addBuddy(searchResult.uid)} className="text-[11px] font-semibold text-teal-600">Add</button>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3 mt-2">
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wide">
          <Users size={12} /> Uplift Buddies
        </span>
        {buddyUids.length < 5 && (
          <button onClick={() => setAddOpen((v) => !v)} className="rounded-full border border-slate-200 p-0.5 hover:bg-slate-200 transition-colors">
            <Plus size={13} className="text-slate-500" />
          </button>
        )}
      </div>
      {buddyProfiles.length === 0 && !addOpen && <p className="text-[11px] text-slate-400">Add up to 5 buddies.</p>}
      <div className="space-y-1.5">
        {buddyProfiles.map((b) => (
          <div key={b.uid} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {b.profilePhotoUrl
                ? <img src={b.profilePhotoUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                : <div className="h-6 w-6 rounded-full bg-teal-100 flex items-center justify-center text-[10px] font-bold text-teal-700">{(b.fullName ?? "?")[0]}</div>}
              <span className="text-xs text-slate-700">{b.fullName}</span>
              {b.moodTag && <MoodPill mood={b.moodTag} tiny />}
            </div>
            <div className="flex items-center gap-1.5">
              <button onClick={() => removeBuddy(b.uid)} className="text-slate-300 hover:text-rose-400 transition-colors"><X size={12} /></button>
            </div>
          </div>
        ))}
      </div>
      {addOpen && (
        <div className="mt-2 space-y-1.5">
          <button onClick={handleShareInvite}
            className="w-full rounded-xl border border-teal-200 bg-teal-50 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-100 transition-colors">
            {copied ? "Copied!" : "Share invite"}
          </button>
          <input value={inviteInput} onChange={(e) => setInviteInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && lookupByInput()}
            placeholder="Paste invite link or code…"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400" />
          <button onClick={lookupByInput} disabled={searching}
            className="w-full rounded-xl bg-teal-600 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 transition-colors">
            {searching ? "Searching…" : "Search"}
          </button>
          {searchError && <p className="text-[11px] text-rose-500">{searchError}</p>}
          {searchResult && searchResult.uid !== currentUser?.uid && (
            <div className="flex items-center justify-between rounded-xl border border-teal-200 bg-white px-3 py-2">
              <span className="text-xs text-slate-700">{searchResult.fullName}</span>
              <button onClick={() => addBuddy(searchResult.uid)} className="text-xs font-semibold text-teal-600 hover:text-teal-800">Add</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── onGift callback added ────────────────────────────────────────
export function SparkGiftButton({ db, senderUid, currentUser, profile, onGift }) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const canGift = !sent && !sending && currentUser && senderUid && senderUid !== currentUser.uid && Number(profile?.sparkBalance ?? 0) >= GIFT_AMOUNT;

  const sendGift = async () => {
    if (!canGift || !db) return;
    setSending(true);
    try {
      const sRef = doc(db, "users", currentUser.uid);
      const rRef = doc(db, "users", senderUid);
      // Only the SENDER's balance is read — to check they can afford it. The recipient's is
      // bumped with increment(), which needs no read, so a gift never requires reading
      // another member's private profile. See src/publicProfile.js.
      await runTransaction(db, async (tx) => {
        const sSnap = await tx.get(sRef);
        const sB = Number(sSnap.exists() ? sSnap.data().sparkBalance ?? 0 : 0);
        if (sB < GIFT_AMOUNT) throw new Error("insufficient");
        tx.set(sRef, { sparkBalance: sB - GIFT_AMOUNT }, { merge: true });
        tx.set(rRef, { sparkBalance: increment(GIFT_AMOUNT) }, { merge: true });
      });
      setSent(true);
      if (onGift) onGift("🎁"); // 🎁 trigger gift burst animation
    } catch { }
    finally { setSending(false); }
  };

  if (!currentUser || senderUid === currentUser.uid) return null;
  return (
    <div className="relative group/gift">
      <button type="button" onClick={sendGift} disabled={!canGift}
        style={{ minHeight: 36 }}
        className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-all ${
          sent ? "border-emerald-300 bg-emerald-50 text-emerald-600"
            : canGift ? "border-slate-200 bg-white text-slate-500 hover:border-amber-200 hover:text-amber-500 hover:scale-105 active:scale-95"
            : "border-slate-100 text-slate-300 cursor-not-allowed"
        }`}>
        <Gift size={10} />
        {sent ? `Gifted! 🎉` : sending ? "…" : `Gift ${GIFT_AMOUNT} 💧`}
      </button>
      {/* Tooltip */}
      {!sent && (
        <div className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1.5 text-[10px] text-white opacity-0 shadow-lg transition-opacity group-hover/gift:opacity-100 z-50">
          {canGift ? `Send ${GIFT_AMOUNT} drops from your balance` : `You need ${GIFT_AMOUNT} drops to gift`}
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// 4. SOCIAL PRESENCE + REACTIONS
// ─────────────────────────────────────────────────────────────────

const PRESENCE_TTL_MS = 5 * 60 * 1000;

export function LiveGreeterCount({ db, currentUser, compact = false }) {
  const [count, setCount] = useState(1);
  const [ticking, setTicking] = useState(false);
  const prevCountRef = useRef(1);

  useEffect(() => {
    if (!db || !currentUser) return;
    const pRef = doc(db, "presence", currentUser.uid);
    const write = () => setDoc(pRef, { lastSeen: Date.now(), uid: currentUser.uid }, { merge: true }).catch(() => {});
    write();
    const id = setInterval(write, 60_000);
    return () => clearInterval(id);
  }, [db, currentUser]);

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "presence"), where("lastSeen", ">=", Date.now() - PRESENCE_TTL_MS));
    return onSnapshot(q, (snap) => {
      const newCount = snap.size;
      if (newCount > prevCountRef.current) {
        setTicking(true);
        setTimeout(() => setTicking(false), 500);
      }
      prevCountRef.current = newCount;
      setCount(newCount);
    }, () => {});
  }, [db]);

  // Compact: tiny inline dot + count, no pill — for use in collapsed header
  if (compact) return (
    <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
      <span style={{ animation: ticking ? "seenLiveTick 450ms ease-out" : "none" }}>
        {count} online
      </span>
    </span>
  );

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
      <span style={{ display:"inline-block", animation: ticking ? "seenLiveTick 450ms ease-out" : "none" }}>
        {count}
      </span>
      &nbsp;greeting{count !== 1 ? "s" : ""} now
    </span>
  );
}

// MessageReactions lived here — a "+ React" tray with its own copy of the reaction transaction,
// imported by App.jsx and rendered by nothing. It is gone, and not only for tidiness: it was a
// THIRD writer of the same documents, and "one reaction per person" is an agreement that only
// holds while there is one writer. Dead code that can break an invariant the moment somebody
// renders it is worse than dead code.
//
// shouldNotifyLike went with it, to reactions.js, where it is now one throttle shared with the
// sticker path rather than two that could both fire for the same person on the same message.


// ── Reaction counts hang off the bubble ──────────────────────────────────────
// The reaction strip's box, in px: its height, and its offset. Referenced twice each — by the
// strip itself and by the heart glow, which subtracts BOTH so the ring keeps hugging the message
// rather than growing past it. They must agree, so they are constants.
//
// The offset used to be a Tailwind `mt-1` class while the glow subtracted the height alone, and
// the 4px difference was visible: the ring's bottom edge fell 4px below the bubble's own border,
// drawing a second, pink, full-width line underneath. Read as "a box behind it" — correctly, as
// that is exactly what it was. It only appeared on hearted messages, since the glow only renders
// when there is a heart, which is what made it look intermittent.
//
// ── WHY IT IS NEGATIVE ───────────────────────────────────────────────────────────────────────
// At +4 the chip sat entirely BELOW the bubble, on its own line, hard against the right edge,
// with nothing joining the two. Measured off a screenshot: bubble's last row at y=1463, chip's
// first at y=1479 — six CSS pixels, so the spacing was never the problem. It read as a small
// object that happened to be underneath a message rather than as a reaction to it.
//
// That was a regression from a fix. The heart badge used to hang over the bubble at
// `absolute -bottom-3 right-1`, and it moved into normal flow when hearts and stickers were
// merged, because two floating rows on opposite edges of one 18px band was the original "the
// stickers fall just below the message" complaint. Flow solved the collision and cost the
// attachment. There is genuinely only one row now, so it can hang again with nothing to hit.
//
// TEN IS NOT A TASTE VALUE. It is exactly the bubble's own bottom padding (`py-2.5`), which makes
// it the deepest the chip can be pulled while still being unable to overlap a letter — even on a
// message whose last line runs the full width. Rendered at 4, -10 and -14 against the real
// stylesheet: -14 looks slightly more tucked and crosses into the text box, which is the one
// thing here worth not risking.
const REACTION_STRIP_H = 26;
const REACTION_STRIP_MT = -10;

export function ReactionSideBadges({ db, messageId, senderUid, currentUser, mine, onReact, onViewReactors, reactorCountry, reactorName, lastGreetingAt = 0, myReactionId = null, onServerReaction, onMyReactionChange, messageTs = 0 }) {
  const [reactions, setReactions] = useState({});

  useEffect(() => {
    if (!db || !messageId) return;
    return onSnapshot(collection(db, "publicMessages", messageId, "reactions"), (snap) => {
      const r = {};
      snap.forEach((d) => { r[d.id] = d.data(); });
      setReactions(r);
    }, () => {});
  }, [db, messageId]);

  // ── What the server says I have on this message ────────────────────────────────────────────
  // At most one document can hold me, so this is a single id or nothing. It is reported upward
  // rather than used directly: App merges it with the optimistic value and hands the result back
  // as `myReactionId`, so the chips, the picker's selection ring and the next write all read one
  // number. Deriving it here from a prop that App itself computed would be a loop; deriving it
  // only from the snapshot cannot be.
  const uid = currentUser?.uid;
  const serverReactionId = useMemo(() => {
    if (!uid) return null;
    for (const [id, d] of Object.entries(reactions)) {
      if ((d?.uids ?? []).includes(uid)) return id;
    }
    return null;
  }, [reactions, uid]);

  // Reports (messageId, id) rather than just the id so App can pass ONE stable callback for the
  // whole feed. A per-message closure would be a new function on every App render, which would
  // re-run this effect on every render of every message in the list.
  useEffect(() => { onServerReaction?.(messageId, serverReactionId); }, [messageId, serverReactionId, onServerReaction]);

  // The count a person should see, for any one reaction document.
  //
  // Self-healing by construction: my own membership is taken from `myReactionId`, which is the
  // optimistic answer, and the server's own record of me is subtracted out. While the two agree
  // the adjustments cancel exactly; while they disagree the number is what the person just did.
  // Nothing has to be cleared when the snapshot catches up — it simply stops differing.
  const countFor = (id) => {
    const d = reactions[id];
    const server = d?.count ?? 0;
    const onServer = (d?.uids ?? []).includes(uid);
    const isMine = myReactionId === id;
    return Math.max(0, server - (onServer ? 1 : 0) + (isMine ? 1 : 0));
  };

  const displayCount = countFor(HEART);
  const active = displayCount > 0 ? [HEART] : [];

  // The stickers on this message. This listener was ALREADY reading these documents and
  // discarding them, while StickerDisplay opened a second listener on the same collection to
  // render them in a second row below the bubble. One listener, one row.
  const stickers = STICKERS
    .map((def) => ({ def, count: countFor(def.id), isMine: myReactionId === def.id }))
    .filter((x) => x.count > 0);
  // Bounded: this row floats over the card, so it cannot be allowed to wrap onto a second line
  // and collide with the message underneath. Past three, the overflow chip carries the rest and
  // opens the panel that can show them all properly.
  const STICKER_SLOTS = 3;
  const shownStickers = stickers.slice(0, STICKER_SLOTS);
  const hiddenStickerCount = stickers
    .slice(STICKER_SLOTS)
    .reduce((n, x) => n + x.count, 0);

  // Invite the FIRST real heart on a recent, un-reacted greeting from someone else — so a post
  // that would otherwise get no response gets a GENUINE reaction (never a fabricated one).
  //
  // Stickers count as a response. Offering "be the first" under a message someone has already
  // answered with a hug told the sender their message was ignored when it was not.
  const BE_FIRST_WINDOW_MS = 3 * 60 * 60 * 1000;
  const showBeFirst = !mine && displayCount === 0 && stickers.length === 0
    && senderUid && senderUid !== currentUser?.uid
    && messageTs && (Date.now() - messageTs < BE_FIRST_WINDOW_MS);

  if (active.length === 0 && displayCount === 0 && stickers.length === 0 && !showBeFirst) return null;

  // The heart chip. Tapping it either sets the heart as my one reaction — replacing a sticker if
  // I had one — or, if the heart already IS my reaction, takes it back.
  //
  // The write itself lives in reactions.js and is shared with the sticker picker, because "one
  // reaction per person" is an agreement that two separate writers cannot keep. What stays here
  // is the part that is genuinely the heart's: the ripple ledger.
  const toggle = (emoji) => {
    if (!db || !currentUser || !messageId) return;
    if (senderUid && senderUid === currentUser.uid) return; // can't react to your own message

    const isSame = myReactionId === emoji;
    const nextId = isSame ? null : emoji;
    const myCountry = reactorCountry ?? null;

    // Paint first. onMyReactionChange puts the new value in App's optimistic map, which comes
    // straight back down as `myReactionId` — so the chip moves in the same frame as the tap and
    // the network happens behind it.
    onMyReactionChange?.(nextId);
    if (!isSame && onReact) onReact(emoji);

    setMyReaction({ db, uid: currentUser.uid, messageId, fromId: myReactionId, toId: nextId, country: myCountry })
      .then(() => {
        announceReaction({
          db, currentUser, messageId, senderUid,
          reaction: nextId ? { id: HEART, emoji: HEART } : null,
          country: myCountry, reactorName,
        });
      })
      .catch((err) => { console.error("[reaction write]", err?.code, err?.message); });

    if (!senderUid || senderUid === currentUser.uid) return;

    // ── Ripples — heart-only, and deliberately so ──────────────────────────────────────────
    // My own record of who I reacted to, which powers ripple attribution when I later send a
    // greeting (see handleSendMessage in App.jsx). Best-effort and invisible in the UI.
    //
    // Note what is NOT here: switching from a heart to a sticker leaves this row alone. It
    // records that I reacted to this person, which is still true — swapping which reaction is
    // not un-reacting.
    const myReactionRef = doc(db, "users", currentUser.uid, "outgoingReactions", messageId);
    if (isSame) {
      deleteDoc(myReactionRef).catch(() => {});
      return;
    }

    // Write outgoingReactions then immediately check if this reactor already sent
    // a greeting within the ripple window ("send → react" ordering). If yes,
    // credit the ripple to the original sender right now rather than waiting for
    // the reactor's next send.
    const RIPPLE_WINDOW_MS = 48 * 60 * 60 * 1000;
    const reactedAt = Date.now();
    setDoc(myReactionRef, {
      senderUid, messageId, country: myCountry, reactedAt, converted: false,
    }).then(async () => {
      try {
        const cutoff = reactedAt - RIPPLE_WINDOW_MS;
        // lastGreetingAt is passed in from the cached profile — avoids a per-like profile read.
        if (lastGreetingAt >= cutoff) {
          // Reactor already sent within the window — credit the ripple now.
          await Promise.all([
            setDoc(
              doc(db, "users", senderUid, "ripples", currentUser.uid),
              {
                originatorUid: senderUid,
                responderUid: currentUser.uid,
                reactedAt,
                greetedAt: lastGreetingAt,
                responderCountry: myCountry,
                createdAt: reactedAt,
              },
              { merge: true }
            ),
            setDoc(myReactionRef, { converted: true }, { merge: true }),
          ]);
        }
      } catch (err) {
        console.error("[ripple on-react]", err?.code, err?.message);
      }
    }).catch((err) => { console.error("[outgoingReactions write]", err?.code, err?.message); });
  };

  // Zero reactions but recent + not mine → invite the first (real) heart.
  //
  // Keyed on showBeFirst rather than on "no hearts", which is what it used to test. Those were
  // the same condition until stickers joined this row: a message answered with a hug but no
  // heart would otherwise take this branch and render "Be first" INSTEAD of the hug — telling
  // the sender nobody had responded, on top of hiding the response.
  if (showBeFirst) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); toggle("❤️"); }}
        className="ml-auto flex items-center gap-1 rounded-full border border-rose-200 bg-white/90 px-2 py-0.5 text-[10px] font-semibold text-rose-400 shadow-sm active:scale-90 transition-all"
        style={{ zIndex: 3, height: REACTION_STRIP_H, marginTop: REACTION_STRIP_MT }}
        title="Be the first to send a heart">
        🤍 Be first
      </button>
    );
  }

  // Glow intensity grows with heart count: 1-2 faint, 3-6 medium, 7+ vivid
  const glowTier = displayCount >= 7 ? 3 : displayCount >= 3 ? 2 : 1;

  return (
    <>
      {displayCount > 0 && (
        // inset-0 would stretch the ring down over the strip below, tracing a box around the
        // chips instead of around the message. The offset is a constant rather than measured
        // because the strip cannot wrap — see the note on it below. The glow only ever renders
        // when a heart exists, and a heart always renders a chip, so the strip is always there
        // to offset against.
        //
        // Height AND gap. Subtracting the height alone left the ring 4px low, which is the line
        // that appeared under hearted bubbles.
        <div
          aria-hidden="true"
          className="seen-heart-glow pointer-events-none absolute inset-x-0 top-0"
          style={{ bottom: REACTION_STRIP_H + REACTION_STRIP_MT }}
          data-tier={glowTier}
        />
      )}
    {/* ONE reaction strip. Hearts and stickers used to be two rows — the heart floating over
        the bubble's bottom edge, the stickers in flow 6px beneath it — which put two sets of
        reactions to the same message in the same band on opposite sides of the card.

        It sits in the normal flow, so a message with reactions takes the room it needs and one
        without stays tight against the next. The first fix for that was bottom padding on every
        message row, which bought the room by loosening the ENTIRE feed — 14px between messages
        inside a group, where the grouping is the thing telling you they are one person talking.

        flex-nowrap is load-bearing rather than stylistic: the glow below is offset by exactly
        one strip height, so the strip has to be exactly one line tall. Nothing can wrap it —
        the heart plus at most three stickers plus an overflow chip is about 150px, and anything
        beyond that is folded into the "+N". */}
    <div
      className="flex flex-nowrap items-center justify-end gap-0.5"
      style={{ zIndex: 3, height: REACTION_STRIP_H, marginTop: REACTION_STRIP_MT }}>
      {active.map((e) => {
        const mine2 = myReactionId === e;
        const count = countFor(e);
        // On your OWN message the badge can't toggle (you can't react to yourself), so the
        // whole thing opens the "who felt this" viewer.
        //
        // On SOMEONE ELSE'S message that badge has two jobs and liking used to win both, which
        // is why the viewer looked like an owner-only feature — it was never locked, the tap was
        // simply taken. So the two jobs get their own targets: the emoji sends a heart, the
        // number says who sent one. The border, background and hit area move to the wrapper so
        // it still reads and behaves as a single pill.
        const isOwn = senderUid && senderUid === currentUser?.uid;
        return (
          <span key={e}
            className={`seen-react-badge relative flex items-center rounded-full border text-[10px] font-semibold shadow-sm transition-all hover:scale-110 before:absolute before:-inset-2 before:content-[''] ${
              mine2 ? "is-mine border-teal-300 bg-teal-50 text-teal-700" : "border-slate-200 bg-white text-slate-600"
            }`}>
            <button
              onClick={() => (isOwn && onViewReactors ? onViewReactors() : toggle(e))}
              title={isOwn ? "See who felt this" : mine2 ? "Take your heart back" : "Send a heart"}
              className="relative z-[1] py-1 pl-2 pr-0.5 active:scale-90 transition-transform">
              {e}
            </button>
            <button
              onClick={() => onViewReactors?.()}
              disabled={!onViewReactors}
              title={onViewReactors ? "See who felt this" : undefined}
              className="relative z-[1] py-1 pl-0.5 pr-2 active:scale-90 transition-transform disabled:cursor-default">
              {count}
            </button>
          </span>
        );
      })}

      {/* Stickers, in the same strip. These used to be inert decoration; tapping one now opens
          the same panel the heart count does, so "who sent me that hug?" is answerable. */}
      {shownStickers.map(({ def, count, isMine }) => {
        return (
          <button
            key={def.id}
            onClick={() => onViewReactors?.()}
            disabled={!onViewReactors}
            title={onViewReactors ? `${def.label} — see who felt this` : def.label}
            className={`seen-react-badge relative flex items-center gap-0.5 rounded-full border px-1.5 py-1 text-[10px] font-semibold shadow-sm transition-all hover:scale-110 active:scale-90 disabled:cursor-default ${
              isMine ? "is-mine border-teal-300 bg-teal-50 text-teal-700" : "border-slate-200 bg-white text-slate-600"
            }`}>
            <span className={`text-[13px] leading-none select-none ${def.anim}`}>{def.emoji}</span>
            {count > 1 && <span>{count}</span>}
          </button>
        );
      })}

      {hiddenStickerCount > 0 && (
        <button
          onClick={() => onViewReactors?.()}
          disabled={!onViewReactors}
          title="See every reaction"
          className="seen-react-badge relative rounded-full border border-slate-200 bg-white px-1.5 py-1 text-[10px] font-semibold text-slate-500 shadow-sm transition-all hover:scale-110 active:scale-90 disabled:cursor-default">
          +{hiddenStickerCount}
        </button>
      )}
    </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// GAP 1 FIX — WAVE BACK
// ─────────────────────────────────────────────────────────────────

// ── onWave callback added ────────────────────────────────────────
export function WaveBackButton({ db, messageId, senderUid, currentUser, onWave }) {
  const [waved, setWaved] = useState(false);
  const [waving, setWaving] = useState(false);
  const canWave = !waved && !waving && currentUser && senderUid && senderUid !== currentUser.uid;

  const sendWave = async () => {
    if (!canWave || !db) return;
    setWaving(true);
    try {
      await addDoc(collection(db, "waves"), {
        fromUid: currentUser.uid,
        toUid: senderUid,
        messageId,
        createdAt: Date.now(),
        read: false,
      });
      setWaved(true);
      if (onWave) onWave();
    } catch { }
    finally { setWaving(false); }
  };

  if (!currentUser || senderUid === currentUser.uid) return null;
  return (
    <div className="relative group/wave">
      <button type="button" onClick={sendWave} disabled={!canWave}
        className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-all ${
          waved ? "border-teal-300 bg-teal-50 text-teal-600"
            : canWave ? "border-slate-200 bg-white text-slate-500 hover:border-teal-200 hover:text-teal-500 hover:scale-105 active:scale-95"
            : "border-slate-100 text-slate-300 cursor-not-allowed"
        }`}>
        {waved ? "👋 Sent warmth!" : waving ? "…" : "👋 Send warmth"}
      </button>
      {/* Tooltip */}
      {!waved && canWave && (
        <div className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1.5 text-[10px] text-white opacity-0 shadow-lg transition-opacity group-hover/wave:opacity-100 z-50">
          Let them know you&apos;re here 🤝
          <span className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
        </div>
      )}
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────
// REACTIONS INBOX — shows reactions your messages have received
// ─────────────────────────────────────────────────────────────────

const REACTION_LABEL = {
  "❤️": "loved your message",
  "🙏": "thanked you",
  "😊": "said you made them smile",
  "🌟": "called you a star",
};

export function ReactionsInbox({ db, currentUser }) {
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!db || !currentUser) return;
    // Listen to all public messages by this user
    const q = query(
      collection(db, "publicMessages"),
      where("uid", "==", currentUser.uid),
      orderBy("timestamp", "desc"),
      limit(20)
    );
    return onSnapshot(q, (snap) => {
      const msgs = snap.docs.map((d) => ({ id: d.id, text: d.data().text }));

      // For each message, listen to its reactions subcollection
      // We cache unsubscribers and merge results
      const allReactions = [];
      const unsubs = msgs.map(({ id: msgId, text }) =>
        onSnapshot(collection(db, "publicMessages", msgId, "reactions"), (rSnap) => {
          rSnap.forEach((rDoc) => {
            const data = rDoc.data();
            const emoji = rDoc.id;
            const count = data.count ?? 0;
            if (count > 0) {
              allReactions.push({ msgId, text, emoji, count });
            }
          });
          // Deduplicate and sort by count desc
          const seen = new Set();
          const deduped = allReactions.filter(({ msgId: m, emoji: e }) => {
            const key = `${m}:${e}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setItems(deduped.slice(0, 5));
        }, () => {})
      );
      return () => unsubs.forEach((u) => u());
    }, () => {});
  }, [db, currentUser]);

  const [dismissed, setDismissed] = useState(new Set());
  const visible = items.filter((x) => !dismissed.has(`${x.msgId}:${x.emoji}`));

  if (visible.length === 0) return null;

  return (
    <div className="mb-3 rounded-2xl border border-violet-100 bg-violet-50/60 px-3 py-2.5">
      <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-violet-500">
        <span>💌</span> Reactions to your messages
      </p>
      <div className="space-y-1">
        {visible.map(({ msgId, text, emoji, count }) => {
          const key = `${msgId}:${emoji}`;
          const label = REACTION_LABEL[emoji] ?? "reacted";
          const short = text.length > 28 ? text.slice(0, 28) + "…" : text;
          return (
            <div key={key}
              className="flex items-center justify-between gap-2 rounded-xl bg-white/80 px-2.5 py-1.5 text-[11px] text-slate-700 shadow-sm">
              <span className="flex items-center gap-1.5 min-w-0">
                <span style={{ fontSize: "15px" }}>{emoji}</span>
                <span className="truncate">
                  <span className="font-semibold">{count} {count === 1 ? "person" : "people"}</span>
                  {" "}{label}
                  <span className="text-slate-400"> · &ldquo;{short}&rdquo;</span>
                </span>
              </span>
              <button onClick={() => setDismissed((s) => new Set(s).add(key))}
                className="flex-shrink-0 text-slate-300 hover:text-slate-500 transition-colors ml-1">
                <X size={11} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function WaveNotifications({ db, currentUser }) {
  const [waves, setWaves] = useState([]);
  const [senderNames, setSenderNames] = useState({});

  useEffect(() => {
    if (!db || !currentUser) return;
    const q = query(
      collection(db, "waves"),
      where("toUid", "==", currentUser.uid),
      where("read", "==", false),
      limit(5)
    );
    return onSnapshot(q, async (snap) => {
      const incoming = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setWaves(incoming);
      const unknownUids = incoming.map((w) => w.fromUid).filter((uid) => uid && !senderNames[uid]);
      if (unknownUids.length > 0) {
        const profiles = await Promise.all(unknownUids.map((uid) => readPublicProfile(db, uid).then((p) => ({ uid, p }))));
        const newNames = {};
        profiles.forEach(({ uid, p: data }) => {
          if (data) {
            newNames[uid] = data.country ? `Someone in ${data.country}` : "Someone";
          }
        });
        setSenderNames((prev) => ({ ...prev, ...newNames }));
      }
    }, () => {});
  }, [db, currentUser]);

  const dismissWave = async (waveId) => {
    if (!db) return;
    await setDoc(doc(db, "waves", waveId), { read: true }, { merge: true }).catch(() => {});
  };

  if (waves.length === 0) return null;
  return (
    <div className="space-y-1.5 mb-3">
      {waves.map((wave) => (
        <div key={wave.id}
          className="flex items-center justify-between rounded-2xl border border-teal-200 bg-teal-50 px-3 py-2 text-xs text-teal-800">
          <span className="flex items-center gap-2">
            <span style={{ fontSize: "14px" }}>👋</span>
            <span>{senderNames[wave.fromUid] ?? "Someone"} waved at you!</span>
          </span>
          <button onClick={() => dismissWave(wave.id)} className="text-teal-400 hover:text-teal-700 ml-2">
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// GAP 2 FIX — MOOD TAG
// ─────────────────────────────────────────────────────────────────

export const MOOD_OPTIONS = [
  { id: "grateful",   label: "Grateful",    emoji: "🙏" },
  { id: "hopeful",    label: "Hopeful",     emoji: "🌱" },
  { id: "tired",      label: "Tired",       emoji: "😴" },
  { id: "happy",      label: "Happy",       emoji: "😊" },
  { id: "struggling", label: "Struggling",  emoji: "🌧️" },
  { id: "peaceful",   label: "Peaceful",    emoji: "☁️" },
  { id: "energised",  label: "Energised",   emoji: "⚡" },
  { id: "lonely",     label: "Lonely",      emoji: "🌙" },
];

const MOOD_PILL_STYLES = {
  grateful:   { backgroundColor: "#f0f4ef", borderColor: "#b5cdb5", color: "#3d6e3d" },
  hopeful:    { backgroundColor: "#fefce8", borderColor: "#fde047", color: "#713f12" },
  tired:      { backgroundColor: "#f1f5f9", borderColor: "#cbd5e1", color: "#334155" },
  happy:      { backgroundColor: "#fff7ed", borderColor: "#fed7aa", color: "#9a3412" },
  struggling: { backgroundColor: "#fdf2f5", borderColor: "#f0c4cf", color: "#8b3547" },
  peaceful:   { backgroundColor: "#f0f9ff", borderColor: "#bae6fd", color: "#0c4a6e" },
  energised:  { backgroundColor: "#fef2f2", borderColor: "#fecaca", color: "#991b1b" },
  lonely:     { backgroundColor: "#f5f3ff", borderColor: "#ddd6fe", color: "#4c1d95" },
};

export function MoodPill({ mood, tiny = false }) {
  const found = MOOD_OPTIONS.find((m) => m.id === mood);
  if (!found) return null;
  const s = MOOD_PILL_STYLES[mood] || { backgroundColor: "#f8fafc", borderColor: "#e2e8f0", color: "#475569" };
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full border ${tiny ? "px-1.5 py-0 text-[9px]" : "px-2 py-0.5 text-[11px]"}`}
      style={{ backgroundColor: s.backgroundColor, borderColor: s.borderColor, color: s.color }}
    >
      <span style={{ fontSize: tiny ? "9px" : "11px" }}>{found.emoji}</span>
      {!tiny && <span>{found.label}</span>}
    </span>
  );
}

// MoodSelector removed — the free-text "feeling status" (src/Feelings.jsx) is now the single
// "how are you feeling?" surface. MOOD_OPTIONS / MoodPill are kept (buddy-list mood pills).

// ─────────────────────────────────────────────────────────────────
// GAP 4 FIX — PREMIUM UPGRADE PROMPT
// ─────────────────────────────────────────────────────────────────

const PRICE_DISPLAY = {
  "United Kingdom": "£3.19/mo",
  "Ireland": "€3.69/mo",
  "Germany": "€3.69/mo",
  "France": "€3.69/mo",
  "Spain": "€3.69/mo",
  "Italy": "€3.69/mo",
  "Netherlands": "€3.69/mo",
  "Belgium": "€3.69/mo",
  "Portugal": "€3.69/mo",
  "Austria": "€3.69/mo",
  "Sweden": "€3.69/mo",
  "Denmark": "€3.69/mo",
  "Finland": "€3.69/mo",
  "Poland": "€3.69/mo",
  "Australia": "AU$5.99/mo",
  "New Zealand": "NZ$6.49/mo",
  "Canada": "CA$5.49/mo",
  "India": "₹329/mo",
  "Japan": "¥599/mo",
  "South Korea": "₩4,900/mo",
  "Brazil": "R$19.90/mo",
};

export function PremiumUpgradePrompt({ onClose, currentUser, country }) {
  const displayPrice = PRICE_DISPLAY[country] ?? "$3.99/mo";
  const BENEFITS = [
    { icon: "📅", title: "25 greetings per day",       sub: "Free plan: 10/day" },
    { icon: "💪", title: "Exclusive greeting packs",    sub: "Strength, Celebrate, World Moments" },
    { icon: "🗓️", title: "Monthly themed pack",        sub: "Rotates every month — Earth Month, Gratitude…" },
    { icon: "📊", title: "Kindness analytics",          sub: "Stats, streaks & 30-day activity heatmap" },
    { icon: "✦",  title: "Premium badge on your name", sub: "Visible to everyone in the chat" },
    { icon: "💬", title: "Accept private chats",        sub: "Connect 1-on-1 with other members" },
  ];

  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-500 to-emerald-500 px-5 pt-5 pb-4">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-white/20 p-1.5">
                <Sparkles size={15} className="text-white" />
              </div>
              <p className="font-bold text-white text-sm">Seen Premium</p>
            </div>
            <button onClick={onClose} className="rounded-full bg-white/20 p-1 hover:bg-white/30 transition-colors">
              <X size={14} className="text-white" />
            </button>
          </div>
          <p className="text-white/80 text-xs">Everything you unlock for {displayPrice}</p>
        </div>

        {/* Benefits list */}
        <div className="px-5 py-4 space-y-3 max-h-72 overflow-y-auto">
          {BENEFITS.map((b) => (
            <div key={b.title} className="flex items-start gap-3">
              <span className="text-base flex-shrink-0 mt-0.5">{b.icon}</span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800">{b.title}</p>
                <p className="text-[11px] text-slate-400">{b.sub}</p>
              </div>
              <CheckCircle2 size={14} className="text-teal-500 flex-shrink-0 mt-0.5 ml-auto" />
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="px-5 pb-5 pt-2 border-t border-slate-100">
          <button
            onClick={() => startCheckout(currentUser)}
            className="w-full rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity">
            Upgrade — {displayPrice}
          </button>
          <p className="mt-2 text-center text-[10px] text-slate-400">Cancel anytime · No ads, ever{PRICE_DISPLAY[country] ? " · Billed in USD" : ""}</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// PROFILE CARD
// ─────────────────────────────────────────────────────────────────

// A five-tier level ladder lived here (Novice Greeter → Guardian of Joy) alongside its resolver
// getLevelForBalance. Both lost their only caller when the profile card's level tile was removed,
// and then sat unreferenced — a third naming scheme for progress, in a file that already had one
// too many. The Kindness Tree stage is now the only answer to "how far along am I".

// ─────────────────────────────────────────────────────────────────
// EDIT PROFILE SHEET
// ─────────────────────────────────────────────────────────────────

function EditProfileSheet({ db, currentUser, profile, onClose, onSaved }) {
  const [name, setName] = useState(profile?.fullName ?? "");
  const [country, setCountry] = useState(profile?.country ?? "");
  const [mostDays, setMostDays] = useState(profile?.mostDays ?? "");
  const [anotherLife, setAnotherLife] = useState(profile?.anotherLife ?? "");
  // The PREPARED blob — imagePrep's re-encoded JPEG, not the user's file. What gets screened is
  // what gets uploaded, and there is deliberately nowhere in this component that holds the
  // original bytes after the check.
  const [photoBlob, setPhotoBlob] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(profile?.profilePhotoUrl ?? "");
  const [checkingPhoto, setCheckingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);

  // The same two checks onboarding makes (ProfilePhotoStep.jsx). This path had neither, so the
  // two ways of setting the same avatar disagreed about what was allowed: onboarding refused a
  // 10MB file politely, profile-edit accepted it and pushed it into the bucket.
  //
  // storage.rules now enforces both for real — client checks are a courtesy, not a boundary,
  // since the SDK is callable from a console on any signed-in session. But without them the
  // rejection surfaces as `storage/unauthorized`, which reads as "you are not allowed to have a
  // profile picture" rather than "that file is too big". Saying which of the two it is, before
  // the upload starts, is the entire value of checking here as well.
  const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    // Clear the input straight away so the SAME file can be picked again after a rejection —
    // otherwise the value is unchanged, no change event fires, and the button looks broken to
    // somebody who wants to retry after an outage.
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("That file isn't an image. Please choose a photo.");
      return;
    }
    if (file.size > AVATAR_MAX_BYTES) {
      setError("Please choose an image smaller than 2MB.");
      return;
    }
    setError("");
    setCheckingPhoto(true);
    try {
      // Re-encode FIRST. Everything after this point handles our JPEG, never the picked file:
      // the EXIF (including the GPS coordinates a phone photo carries) is gone, the bytes are a
      // couple of hundred kilobytes, and the picture below is the picture that was reviewed.
      // See src/imagePrep.js.
      const prepared = await prepareImage(file);
      const verdict = await authedPost(currentUser, "/api/moderate-message", {
        image: { base64: prepared.base64, mediaType: prepared.mediaType },
        context: "avatar",
      });
      // No verdict is a refusal, not a pass. The image path has no word-list fallback, because
      // there is no word list for pixels — see the header of api/moderate-message.js.
      if (!verdict.checked || !verdict.ok) {
        URL.revokeObjectURL(prepared.previewUrl);
        setError(!verdict.checked
          ? "We couldn't check that photo just now. Please try again in a moment."
          : (verdict.reason || "That photo didn't pass our safety check — please choose another."));
        return;
      }
      if (photoPreview.startsWith("blob:")) URL.revokeObjectURL(photoPreview);
      setPhotoBlob(prepared.blob);
      setPhotoPreview(prepared.previewUrl);
    } catch (err) {
      console.error("[profile] photo check failed:", err?.status ?? err?.message);
      setError(err?.message === "decode_failed"
        ? "We couldn't read that image. Please choose another."
        : "We couldn't check that photo just now. Please try again in a moment.");
    } finally {
      setCheckingPhoto(false);
    }
  };

  const handleSave = async () => {
    // Not while a photo is still being reviewed: saving mid-check would write the profile with
    // the OLD avatar and silently drop the new one the user is watching a spinner for.
    if (!name.trim() || !country || saving || checkingPhoto) return;
    setSaving(true);
    setError("");
    try {
      let profilePhotoUrl = profile?.profilePhotoUrl ?? "";
      if (photoBlob) {
        const storage = getStorage();
        // A fixed name and a fixed type, both ours. The extension used to be taken from the end
        // of the user's filename and pasted into the object path — the exact trick storage.rules
        // calls out by name — and the contentType came from the file. Neither is user-supplied
        // any more, because neither the name nor the bytes are.
        const photoRef = ref(storage, `profilePhotos/${currentUser.uid}/avatar.jpg`);
        await uploadBytes(photoRef, photoBlob, { contentType: PREPARED_TYPE });
        profilePhotoUrl = await getDownloadURL(photoRef);
      }
      const fields = {
        fullName: name.trim(),
        country,
        mostDays: mostDays.trim(),
        anotherLife: anotherLife.trim(),
        profilePhotoUrl,
      };
      await updateDoc(doc(db, "users", currentUser.uid), fields);
      // Keep the readable copy in step. Every one of these fields is public, so an edit that
      // updated only `users` would leave other members — and search — seeing the old name.
      syncPublicProfile(db, currentUser.uid, fields);
      onSaved?.(fields);
      onClose();
    } catch (err) {
      console.error("Profile update error:", err);
      setError("Couldn't save — please try again.");
    }
    setSaving(false);
  };

  return createPortal(
    <div data-portal className="fixed inset-0 z-[220] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />

      <div className="relative sheet-slide-up rounded-t-3xl bg-white shadow-2xl max-h-[92dvh] flex flex-col">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 flex-shrink-0">
          <h2 className="text-sm font-bold text-slate-800">Edit Profile</h2>
          <button onClick={onClose} className="rounded-full p-2 hover:bg-slate-100 transition-colors">
            <X size={16} className="text-slate-400" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-12 space-y-6">
          {/* Photo picker */}
          <div className="flex flex-col items-center gap-3 pt-2">
            <div className="relative">
              {photoPreview
                ? <img src={photoPreview} alt="" className="h-24 w-24 rounded-full object-cover ring-4 ring-slate-100" />
                : <div className="h-24 w-24 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-3xl font-bold text-white ring-4 ring-slate-100">
                    {(name || profile?.fullName || "?")[0]?.toUpperCase()}
                  </div>
              }
              <button
                onClick={() => fileRef.current?.click()}
                disabled={checkingPhoto}
                className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-teal-600 flex items-center justify-center shadow-lg hover:bg-teal-700 transition-colors disabled:opacity-40">
                <Camera size={14} className="text-white" />
              </button>
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={checkingPhoto}
              className="text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors disabled:opacity-40">
              {checkingPhoto ? "Checking your photo…" : "Change photo"}
            </button>
            {/* Said plainly, once, where the choice is made. People are entitled to know a photo
                they upload is looked at before it appears beside their name — and saying so here
                is also what makes a rejection read as a rule rather than a fault. */}
            <p className="text-[11px] text-slate-400 text-center leading-relaxed">
              Photos are checked automatically before they appear.
            </p>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </div>

          {/* Name */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block">
              Display name
            </label>
            <div className="relative">
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={40}
                placeholder="Your full name"
                className="w-full rounded-2xl border border-slate-200 pl-4 pr-10 py-3 text-sm text-slate-800 outline-none focus:border-teal-400 transition-colors"
              />
              <Pencil size={13} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
            </div>
          </div>

          {/* Country */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block">
              Location
            </label>
            <div className="relative">
              <MapPin size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <select
                value={country}
                onChange={e => setCountry(e.target.value)}
                className="w-full rounded-2xl border border-slate-200 pl-9 pr-4 py-3 text-sm text-slate-800 outline-none focus:border-teal-400 bg-white appearance-none transition-colors">
                <option value="">Select your country</option>
                {COUNTRY_OPTIONS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Your glimpse — what others see when they tap your name */}
          <div className="space-y-3">
            <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wide block">
              Your glimpse
            </label>
            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">💛 Most days, I'm…</p>
              <input
                value={mostDays}
                onChange={e => setMostDays(e.target.value)}
                maxLength={120}
                placeholder="a tired but hopeful nurse"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none focus:border-teal-400 transition-colors"
              />
              <GlimpseChips examples={MOST_DAYS_EXAMPLES} accent="amber" onPick={setMostDays} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600 mb-1">✨ In another life, I'd be…</p>
              <input
                value={anotherLife}
                onChange={e => setAnotherLife(e.target.value)}
                maxLength={120}
                placeholder="a jazz pianist in Lisbon"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none focus:border-teal-400 transition-colors"
              />
              <GlimpseChips examples={ANOTHER_LIFE_EXAMPLES} accent="violet" onPick={setAnotherLife} />
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">Keep it light — no personal details. This is the little glimpse others see.</p>
          </div>

          {error && <p className="text-xs text-red-500 text-center">{error}</p>}

          {/* Save */}
          <button
            onClick={handleSave}
            disabled={!name.trim() || !country || saving || checkingPhoto}
            className="w-full rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 py-3.5 text-sm font-bold text-white hover:opacity-90 transition-opacity disabled:opacity-40">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─────────────────────────────────────────────────────────────────
// PROFILE CARD
// ─────────────────────────────────────────────────────────────────

// `streak` and `sparkBalance` are no longer props: the tiles that displayed them are gone.
export function ProfileCard({ profile, onClose, db, currentUser, onOpenBlocked, onOpenChangePassword }) {
  const cardRef = useRef(null);
  const [copying, setCopying] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [localProfile, setLocalProfile] = useState(profile);

  useEffect(() => { setLocalProfile(profile); }, [profile]);

  const handleShare = async () => {
    setCopying(true);
    try {
      if (!window.html2canvas) {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
          s.onload = resolve; s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      const canvas = await window.html2canvas(cardRef.current, { scale: 2, useCORS: true });
      canvas.toBlob(async (blob) => {
        if (navigator.share && blob) {
          await navigator.share({ files: [new File([blob], "seen-card.png", { type: "image/png" })], title: "My Seen Profile" });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a"); a.href = url; a.download = "seen-card.png"; a.click();
          URL.revokeObjectURL(url);
        }
      }, "image/png");
    } catch { }
    finally { setCopying(false); }
  };

  return (
    <>
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
        <div className="w-full max-w-sm">
          {/* Card (shareable) */}
          <div ref={cardRef} className="rounded-3xl bg-gradient-to-br from-teal-500 to-emerald-400 p-6 text-white shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              {localProfile?.profilePhotoUrl
                ? <img src={localProfile.profilePhotoUrl} alt="" className="h-14 w-14 rounded-full border-2 border-white/40 object-cover" />
                : <div className="h-14 w-14 rounded-full border-2 border-white/40 bg-white/20 flex items-center justify-center text-xl font-bold">{(localProfile?.fullName ?? "?")[0]}</div>}
              <div className="flex-1 min-w-0">
                <p className="text-lg font-extrabold truncate">{localProfile?.fullName}</p>
                <p className="text-sm text-white/80 truncate">{localProfile?.country}</p>
              </div>
              {db && currentUser && (
                <button
                  onClick={() => setShowEdit(true)}
                  className="flex-shrink-0 h-8 w-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                  title="Edit profile">
                  <Pencil size={13} className="text-white" />
                </button>
              )}
            </div>
            {/* The streak / drops / level tiles used to sit here. They were removed in the
                V2 review pass: the card is meant to say who you are, and three scoreboard
                numbers turned it into a stats readout. The same figures still live on
                Grow, which is where someone goes when they actually want them. */}
            <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2">
              <Heart size={12} className="text-pink-200" />
              <p className="text-xs text-white/90">Spreading kindness with Seen 🌟</p>
            </div>
          </div>

          {/* The "How you're feeling" box lived here. The whole feelings feature is retired —
              see the note at the top of src/Feelings.jsx for what it was and why it went. */}

          {/* Actions */}
          <div className="mt-3 flex gap-2">
            <button onClick={handleShare} disabled={copying}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white py-3 text-sm font-semibold text-teal-700 hover:bg-teal-50 transition-colors">
              <Share2 size={14} />
              {copying ? "Preparing…" : "Share / Save"}
            </button>
            {db && currentUser && (
              <button onClick={() => setShowEdit(true)}
                className="flex items-center justify-center gap-1.5 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                <Pencil size={14} />
                Edit
              </button>
            )}
            <button onClick={onClose}
              className="rounded-2xl border border-white/30 bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-colors">
              Close
            </button>
          </div>

          {/* Account sub-options — nested here under "Person behind the Kindness" */}
          {(onOpenBlocked || onOpenChangePassword) && (
            <div className="mt-3 rounded-2xl bg-white shadow-lg overflow-hidden divide-y divide-slate-100">
              {onOpenBlocked && (
                <button onClick={onOpenBlocked}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors">
                  <span className="text-base">🚫</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-slate-700">Blocked accounts</span>
                    <span className="block text-[11px] text-slate-400">Manage people you've blocked</span>
                  </span>
                  <ChevronRight size={16} className="text-slate-300" />
                </button>
              )}
              {onOpenChangePassword && (
                <button onClick={onOpenChangePassword}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 transition-colors">
                  <span className="text-base">🔑</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-slate-700">Change password</span>
                    <span className="block text-[11px] text-slate-400">Update your account password</span>
                  </span>
                  <ChevronRight size={16} className="text-slate-300" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {showEdit && (
        <EditProfileSheet
          db={db}
          currentUser={currentUser}
          profile={localProfile}
          onClose={() => setShowEdit(false)}
          onSaved={(updates) => setLocalProfile(p => ({ ...p, ...updates }))}
        />
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────

export function scheduleGreetingWindowNotification(profile) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  const now = new Date();
  let targetHour = 8;
  if (profile?.lastGreetingAt) targetHour = new Date(profile.lastGreetingAt).getHours();
  const target = new Date(now);
  target.setHours(targetHour, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  const msUntil = target.getTime() - now.getTime();
  if (msUntil > 23 * 60 * 60 * 1000) return;
  const id = setTimeout(() => {
    new Notification("Seen 🌟", { body: "Your daily greeting window is open — spread some kindness!", icon: "/icon-192.png", badge: "/badge-96.png" });
  }, msUntil);
  return () => clearTimeout(id);
}

export function NotificationPermissionBanner({ onPermissionChange } = {}) {
  const [status, setStatus] = useState(typeof Notification !== "undefined" ? Notification.permission : "denied");
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem("seen_notif_dismissed") === "1"; } catch { return false; }
  });
  if (status === "granted" || status === "denied" || dismissed) return null;
  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem("seen_notif_dismissed", "1"); } catch {}
  };
  return (
    <div className="flex items-start justify-between gap-3 rounded-2xl border border-teal-200 bg-teal-50 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-teal-800">Don't miss your reactions 🔔</p>
        <p className="mt-0.5 text-[11px] text-teal-600">Get notified when someone waves, reacts, or sends kindness your way.</p>
      </div>
      <div className="flex items-center gap-2 shrink-0 mt-0.5">
        <button
          onClick={async () => {
            const result = await Notification.requestPermission();
            setStatus(result);
            onPermissionChange?.();
          }}
          className="rounded-xl bg-teal-500 px-3 py-1.5 text-[11px] text-white font-bold hover:bg-teal-600 transition-colors whitespace-nowrap">
          Enable
        </button>
        <button onClick={dismiss} className="text-teal-400 hover:text-teal-600"><X size={13} /></button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// WHATSAPP-STYLE UNIFIED QUICK-REACT BAR
// ─────────────────────────────────────────────────────────────────

const QUICK_EMOJIS = ["❤️"];
const QUICK_GIFT_AMOUNT = 5;

// ── Private-chat invite button shown in the QuickReactBar ─────────────
// Visible to ALL users; non-premium see a locked version that nudges upgrade.
export function QuickReactBar({ db, messageId, senderUid, senderName, currentUser, profile, mine, isPremium, onClose, onWave, onGift, onReact, onSticker, myReactionId = null, onUpgrade, onDelete, onEdit, onReply }) {
  const [waved, setWaved] = useState(false);
  const [gifted, setGifted] = useState(false);
  const [popping, setPopping] = useState(null);
  const [reporting, setReporting] = useState(false);
  const [reported, setReported] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [busy, setBusy] = useState(false);           // a safety write is in flight
  const [safetyError, setSafetyError] = useState(""); // shown when one fails
  const [showStickers, setShowStickers] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // This bar used to open a SECOND listener on the same reactions collection, purely to work out
  // which emoji was mine — while ReactionSideBadges sat on the same collection for the same
  // message doing the same read. It is now told, via `myReactionId`, so opening the bar costs
  // nothing and the bar and the chip can never disagree about what you sent.

  const isOther = !mine && senderUid && senderUid !== currentUser?.uid;

  const handleWave = async () => {
    if (!isOther || !db || waved) return;
    try {
      await addDoc(collection(db, "waves"), {
        fromUid: currentUser.uid, toUid: senderUid,
        messageId, createdAt: Date.now(), read: false,
      });
      setWaved(true);
      onWave?.();
    } catch {}
    setTimeout(() => onClose?.(), 320);
  };

  const handleGift = async () => {
    if (!isOther || !db || gifted) return;
    const balance = Number(profile?.sparkBalance ?? 0);
    if (balance < QUICK_GIFT_AMOUNT) return;
    setGifted(true);
    try {
      await runTransaction(db, async (tx) => {
        const fromRef = doc(db, "users", currentUser.uid);
        const toRef   = doc(db, "users", senderUid);
        // Sender's balance is read (to check they can afford it); the recipient's is
        // incremented, so no read of another member's private profile is needed.
        const fSnap = await tx.get(fromRef);
        const fromBal = Number(fSnap.data()?.sparkBalance ?? 0);
        if (fromBal < QUICK_GIFT_AMOUNT) throw new Error("low");
        tx.set(fromRef, { sparkBalance: fromBal - QUICK_GIFT_AMOUNT }, { merge: true });
        tx.set(toRef,   { sparkBalance: increment(QUICK_GIFT_AMOUNT) }, { merge: true });
      });
      // Record gift in subcollection (uid as doc ID = idempotent, one gift per user)
      // Requires Firestore rule: match /gifts/{giftId} { allow create: if giftId == request.auth.uid }
      setDoc(doc(db, "publicMessages", messageId, "gifts", currentUser.uid), {
        amount: QUICK_GIFT_AMOUNT,
        timestamp: Date.now(),
      }).catch(() => {}); // best-effort badge write — don't fail the gift if rules aren't set yet
      onGift?.("🎁");
    } catch { setGifted(false); }
    setTimeout(() => onClose?.(), 320);
  };

  // The ❤️ in the reaction bar. Same gesture as the chip on the bubble, so the same writer —
  // this used to be a FOURTH independent copy of the reaction transaction, and its idea of "what
  // I already have" was QUICK_EMOJIS, a list containing only the heart. Tapping it while you had
  // a sticker left both on the message, which is the bug this round is about; it could not have
  // been fixed in ReactionSideBadges alone.
  const handleEmoji = (emoji) => {
    if (!db || !currentUser || !messageId) return;
    if (senderUid && senderUid === currentUser.uid) { onClose?.(); return; } // can't react to your own message

    const isSame = myReactionId === emoji;
    const nextId = isSame ? null : emoji;
    const myCountry = profile?.country ?? null;

    // ── Instant UI response ──────────────────────────────────────
    setPopping(emoji);
    setTimeout(() => setPopping(null), 400);
    if (!isSame) onReact?.(emoji);
    // Same callback the sticker picker uses. The bar closes itself, so the optimistic value has
    // to live in App rather than here.
    onSticker?.(nextId, null);
    onClose?.();

    setMyReaction({ db, uid: currentUser.uid, messageId, fromId: myReactionId, toId: nextId, country: myCountry })
      .then(() => {
        announceReaction({
          db, currentUser, messageId, senderUid,
          reaction: nextId ? { id: HEART, emoji: HEART } : null,
          country: myCountry, reactorName: profile?.fullName ?? "",
        });
      })
      .catch((err) => { console.error("[reaction write]", err?.code, err?.message); });

    if (!senderUid || senderUid === currentUser.uid) return;

    // Ripple ledger — heart-only, as on the bubble chip. Swapping a heart for a sticker leaves
    // it alone: it records that I reacted to this person, which stays true.
    const myReactionRef = doc(db, "users", currentUser.uid, "outgoingReactions", messageId);
    if (isSame) {
      deleteDoc(myReactionRef).catch(() => {});
      return;
    }
    const RIPPLE_WINDOW_MS = 48 * 60 * 60 * 1000;
    const reactedAt = Date.now();
    setDoc(myReactionRef, {
      senderUid, messageId, country: myCountry, reactedAt, converted: false,
    }).then(async () => {
      try {
        const cutoff = reactedAt - RIPPLE_WINDOW_MS;
        // profile.lastGreetingAt is already in scope — avoids a composite index on publicMessages.
        const lastGreetingAt = profile?.lastGreetingAt ?? 0;
        if (lastGreetingAt >= cutoff) {
          await Promise.all([
            setDoc(
              doc(db, "users", senderUid, "ripples", currentUser.uid),
              {
                originatorUid: senderUid,
                responderUid: currentUser.uid,
                reactedAt,
                greetedAt: lastGreetingAt,
                responderCountry: myCountry,
                createdAt: reactedAt,
              },
              { merge: true }
            ),
            setDoc(myReactionRef, { converted: true }, { merge: true }),
          ]);
        }
      } catch (err) {
        console.error("[ripple on-react]", err?.code, err?.message);
      }
    }).catch((err) => { console.error("[outgoingReactions write]", err?.code, err?.message); });
  };

  // Confirm only once the write lands. These previously flipped to a tick BEFORE the
  // write and swallowed the error, so a report or block that never persisted still
  // showed as done — the user believed they were protected when they weren't.
  const handleReport = async (reason) => {
    if (busy) return;
    setBusy(true); setSafetyError("");
    try {
      await addDoc(collection(db, "reports"), {
        messageId,
        reporterUid: currentUser?.uid,
        reportedUid: senderUid ?? null,
        reason,
        timestamp: Date.now(),
      });
      setReported(true);
      setTimeout(() => onClose?.(), 1400);
    } catch {
      setSafetyError("Couldn't send that report — check your connection and try again.");
    }
    setBusy(false);
  };

  // Block this author: hides all their content from this user's feed (users/{uid}/blockedUsers).
  const handleBlock = async () => {
    if (!isOther || !db || blocked || busy) return;
    setBusy(true); setSafetyError("");
    try {
      await setDoc(doc(db, "users", currentUser.uid, "blockedUsers", senderUid), {
        name: senderName ?? "Someone",
        blockedAt: Date.now(),
      });
      setBlocked(true);
      setTimeout(() => onClose?.(), 1200);
    } catch {
      setSafetyError("Couldn't block them — check your connection and try again.");
    }
    setBusy(false);
  };

  const canGift = isOther && !gifted && Number(profile?.sparkBalance ?? 0) >= QUICK_GIFT_AMOUNT;

  if (reporting) return (
    <div className="seen-qrb" onClick={(e) => e.stopPropagation()} style={{ flexWrap: "wrap" }}>
      {safetyError && (
        <p style={{ width: "100%", fontSize: 11, fontWeight: 600, color: "#ef4444", padding: "2px 6px" }}>{safetyError}</p>
      )}
      <span style={{ fontSize: 11, color: "rgba(148,163,184,0.8)", padding: "0 4px", flexShrink: 0 }}>Report:</span>
      {["Harmful","Spam","Inappropriate","Other"].map((r) => (
        <button key={r}
          className="seen-qrb-btn"
          style={{ fontSize: 10, width: "auto", padding: "0 8px", height: 34, opacity: busy ? 0.5 : 1 }}
          disabled={busy}
          onClick={() => handleReport(r)}>
          {reported ? "✅" : r}
        </button>
      ))}
      {isOther && (
        <>
          <div className="seen-qrb-sep" />
          <button
            className="seen-qrb-btn"
            title="Block this person"
            style={{ fontSize: 10, width: "auto", padding: "0 8px", height: 34, fontWeight: 700, color: "#ef4444", opacity: busy ? 0.5 : 1 }}
            disabled={busy}
            onClick={handleBlock}>
            {blocked ? "Blocked ✓" : busy ? "Blocking…" : "🚫 Block"}
          </button>
        </>
      )}
      <div className="seen-qrb-sep" />
      <button className="seen-qrb-btn" style={{ fontSize: 16 }} onClick={() => setReporting(false)}>✕</button>
    </div>
  );

  return (
    <div className="seen-qrb" onClick={(e) => e.stopPropagation()}>
      {QUICK_EMOJIS.map((emoji) => (
        <button key={emoji}
          className={`seen-qrb-btn${myReactionId === emoji ? " seen-qrb-btn--picked" : ""}`}
          onClick={() => handleEmoji(emoji)}
          title={myReactionId === emoji ? "Take your heart back" : "Send a heart"}
          style={{ animation: popping === emoji ? "seenReactionPop 380ms cubic-bezier(0.34,1.56,0.64,1) both" : "none" }}>
          {emoji}
        </button>
      ))}
      {/* Animated stickers. The picker below was fully built from the day it shipped and
          setShowStickers(true) was never called from anywhere, so none of it could be reached;
          this button is the whole of what was missing. The reactions it writes now land in the
          same strip as the heart, and reach the recipient. */}
      <div className="seen-qrb-sep" />
      <button
        className="seen-qrb-btn"
        title="React with a sticker"
        style={{ fontSize: 16 }}
        onClick={() => setShowStickers(true)}>
        😀
      </button>
      {/* Reply privately — only on other people's messages. Lives here rather than beside
          the sender's name so nothing hangs outside the bubble. */}
      {!mine && onReply && (
        <>
          <div className="seen-qrb-sep" />
          <button
            className="seen-qrb-btn"
            title="Reply privately"
            style={{ fontSize: 11, fontWeight: 700, width: "auto", padding: "0 10px", height: 34, color: "#A82E2C" }}
            onClick={() => { onReply(); onClose?.(); }}>
            💬 Reply
          </button>
        </>
      )}
      {/* Edit sits before Delete, and unlike Delete it takes one tap. Deleting is irreversible so
          it asks twice; editing opens a sheet you can still close, and the sheet screens the
          result exactly as a new post would. */}
      {mine && onEdit && (
        <>
          <div className="seen-qrb-sep" />
          <button
            className="seen-qrb-btn"
            title="Edit your message"
            style={{ fontSize: 15, width: "auto", padding: "0 8px", height: 34 }}
            onClick={() => { onEdit(); onClose?.(); }}>
            ✏️
          </button>
        </>
      )}
      {mine && onDelete && (
        <>
          <div className="seen-qrb-sep" />
          <button
            className="seen-qrb-btn"
            title={confirmDelete ? "Tap again to confirm" : "Delete your message"}
            style={{ fontSize: 13, fontWeight: 700, width: "auto", padding: "0 8px", height: 34, color: confirmDelete ? "#ef4444" : "rgba(148,163,184,0.7)" }}
            onClick={() => {
              if (confirmDelete) { onDelete(); }
              else {
                setConfirmDelete(true);
                setTimeout(() => setConfirmDelete(false), 3000);
              }
            }}>
            {confirmDelete ? "Delete?" : "🗑️"}
          </button>
        </>
      )}
      <div className="seen-qrb-sep" />
      <button className="seen-qrb-btn" onClick={() => setReporting(true)} title="Report" style={{ fontSize: 16, opacity: 0.5 }}>🚩</button>

      {showStickers && (
        <StickerPicker
          db={db}
          currentUser={currentUser}
          messageId={messageId}
          // The picker needs to know whose message this is and who is reacting, so it can skip
          // your own messages and tell the recipient afterwards. It knew none of that before,
          // which is why a sticker went nowhere.
          senderUid={senderUid}
          reactorCountry={profile?.country ?? null}
          reactorName={profile?.fullName ?? ""}
          onClose={() => setShowStickers(false)}
          // What I currently have on this message — a sticker id, "❤️", or nothing. It does two
          // jobs: the grid rings the one that is mine so re-tapping it is never a surprise, and
          // the write is told what to clear, which is how a heart gets replaced rather than
          // joined by a sticker.
          myReactionId={myReactionId}
          // onSticker, NOT onReact. This used to call onReact(sticker.emoji), and that was the
          // phantom heart: onReact treats "❤️" as a heart tap and applied an optimistic +1 to
          // the badge, while the picker only ever wrote a sticker document — a count with
          // nothing behind it. The two callbacks now converge on one piece of App state, but
          // they stay separate so a heart-ish sticker can never be mistaken for the heart.
          onPick={(nextId) => onSticker?.(nextId)}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// GIFT OVERLAY — golden glow ring + count badge on gifted bubbles
// ─────────────────────────────────────────────────────────────────

export function GiftOverlay({ db, messageId }) {
  const [count, setCount] = useState(0);
  const [glowKey, setGlowKey] = useState(0);
  const prevCountRef = useRef(null); // null = not yet initialized

  useEffect(() => {
    if (!db || !messageId) return;
    // Requires Firestore rule: match /gifts/{giftId} { allow read: if request.auth != null }
    const unsub = onSnapshot(
      collection(db, "publicMessages", messageId, "gifts"),
      (snap) => {
        const newCount = snap.size;
        if (prevCountRef.current === null) {
          // First snapshot: baseline, no animation
          prevCountRef.current = newCount;
          setCount(newCount);
          return;
        }
        if (newCount > prevCountRef.current) {
          setGlowKey((k) => k + 1);
        }
        prevCountRef.current = newCount;
        setCount(newCount);
      },
      () => {}
    );
    return unsub;
  }, [db, messageId]);

  if (count === 0) return null;

  return (
    <>
      {glowKey > 0 && <div key={glowKey} className="gift-glow-ring" />}
      <div className="gift-badge gift-badge--pop">🎁 {count}</div>
    </>
  );
}
