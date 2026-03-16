import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  arrayUnion,
  arrayRemove,
  addDoc,
} from "firebase/firestore";

import {
  Bell,
  CheckCircle2,
  Flame,
  Gift,
  Heart,
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
      return { error: e.message === "insufficient_sparks" ? "Not enough sparks." : "Failed." };
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

  return { streak, freezesAvailable, recordGreetingDay, buyFreeze, useFreeze };
}

export function StreakBadge({ streak }) {
  if (!streak || streak < 1) return null;
  const hot = streak >= 7;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold border ${
      hot ? "bg-orange-50 border-orange-200 text-orange-700" : "bg-slate-50 border-slate-200 text-slate-600"
    }`}>
      <Flame size={12} className={hot ? "text-orange-500" : "text-slate-400"} />
      {streak}d
    </span>
  );
}

export function StreakFreezeButton({ freezes, sparkBalance, onBuy }) {
  const canAfford = sparkBalance >= FREEZE_COST;
  return (
    <button type="button" onClick={onBuy} disabled={!canAfford}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
        freezes > 0 ? "border-cyan-200 bg-cyan-50 text-cyan-700"
        : canAfford ? "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
        : "border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed"
      }`}>
      <Shield size={11} />
      {freezes > 0 ? `${freezes} freeze` : `Freeze (${FREEZE_COST}✨)`}
    </button>
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

export function BuddyPanel({ db, currentUser, profile }) {
  const [buddyProfiles, setBuddyProfiles] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);
  const buddyUids = profile?.buddies ?? [];

  useEffect(() => {
    if (!db || buddyUids.length === 0) { setBuddyProfiles([]); return; }
    Promise.all(buddyUids.slice(0, 5).map((uid) => getDoc(doc(db, "users", uid))))
      .then((docs) => setBuddyProfiles(docs.filter((d) => d.exists()).map((d) => ({ uid: d.id, ...d.data() }))));
  }, [db, JSON.stringify(buddyUids)]);

  const searchForUser = async () => {
    if (!db || !searchEmail.trim()) return;
    setSearching(true); setSearchError(""); setSearchResult(null);
    try {
      const snap = await getDocs(query(collection(db, "users"), where("email", "==", searchEmail.trim().toLowerCase()), limit(1)));
      if (snap.empty) setSearchError("No user found.");
      else { const d = snap.docs[0]; setSearchResult({ uid: d.id, ...d.data() }); }
    } catch { setSearchError("Search failed."); }
    finally { setSearching(false); }
  };

  const addBuddy = async (targetUid) => {
    if (!db || !currentUser) return;
    await updateDoc(doc(db, "users", currentUser.uid), { buddies: arrayUnion(targetUid) });
    setAddOpen(false); setSearchResult(null); setSearchEmail("");
  };

  const removeBuddy = async (targetUid) => {
    if (!db || !currentUser) return;
    await updateDoc(doc(db, "users", currentUser.uid), { buddies: arrayRemove(targetUid) });
  };

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
            <button onClick={() => removeBuddy(b.uid)} className="text-slate-300 hover:text-rose-400 transition-colors"><X size={12} /></button>
          </div>
        ))}
      </div>
      {addOpen && (
        <div className="mt-2 space-y-1.5">
          <input value={searchEmail} onChange={(e) => setSearchEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchForUser()}
            placeholder="Friend's email…"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400" />
          <button onClick={searchForUser} disabled={searching}
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

export function SparkGiftButton({ db, senderUid, currentUser, profile }) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
  const canGift = !sent && !sending && currentUser && senderUid && senderUid !== currentUser.uid && Number(profile?.sparkBalance ?? 0) >= GIFT_AMOUNT;

  const sendGift = async () => {
    if (!canGift || !db) return;
    setSending(true);
    try {
      const sRef = doc(db, "users", currentUser.uid);
      const rRef = doc(db, "users", senderUid);
      await runTransaction(db, async (tx) => {
        const [sSnap, rSnap] = await Promise.all([tx.get(sRef), tx.get(rRef)]);
        const sB = Number(sSnap.exists() ? sSnap.data().sparkBalance ?? 0 : 0);
        if (sB < GIFT_AMOUNT) throw new Error("insufficient");
        const rB = Number(rSnap.exists() ? rSnap.data().sparkBalance ?? 0 : 0);
        tx.set(sRef, { sparkBalance: sB - GIFT_AMOUNT }, { merge: true });
        tx.set(rRef, { sparkBalance: rB + GIFT_AMOUNT }, { merge: true });
      });
      setSent(true);
    } catch { }
    finally { setSending(false); }
  };

  if (!currentUser || senderUid === currentUser.uid) return null;
  return (
    <button type="button" onClick={sendGift} disabled={!canGift}
      className={`mt-1 flex items-center gap-1 text-[10px] font-semibold transition-colors ${
        sent ? "text-amber-600" : canGift ? "text-slate-400 hover:text-amber-500" : "text-slate-300 cursor-not-allowed"
      }`}>
      <Gift size={10} />
      {sent ? `+${GIFT_AMOUNT} gifted!` : sending ? "…" : `Gift ${GIFT_AMOUNT}✨`}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────
// 4. SOCIAL PRESENCE + REACTIONS
// ─────────────────────────────────────────────────────────────────

const PRESENCE_TTL_MS = 5 * 60 * 1000;

export function LiveGreeterCount({ db, currentUser }) {
  const [count, setCount] = useState(1);

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
    return onSnapshot(q, (snap) => setCount(snap.size), () => {});
  }, [db]);

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
      {count} greeting{count !== 1 ? "s" : ""} now
    </span>
  );
}

const REACTION_EMOJIS = ["❤️", "🌟", "🙏", "😊", "✨"];

export function MessageReactions({ db, messageId, currentUser }) {
  const [reactions, setReactions] = useState({});
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!db || !messageId) return;
    return onSnapshot(collection(db, "publicMessages", messageId, "reactions"), (snap) => {
      const r = {};
      snap.forEach((d) => { r[d.id] = d.data(); });
      setReactions(r);
    }, () => {});
  }, [db, messageId]);

  const react = async (emoji) => {
    if (!db || !currentUser || !messageId) return;
    const rRef = doc(db, "publicMessages", messageId, "reactions", emoji);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(rRef);
      const data = snap.exists() ? snap.data() : { count: 0, uids: [] };
      const uids = data.uids ?? [];
      const already = uids.includes(currentUser.uid);
      tx.set(rRef, already
        ? { count: Math.max(0, (data.count ?? 0) - 1), uids: uids.filter((u) => u !== currentUser.uid) }
        : { count: (data.count ?? 0) + 1, uids: [...uids, currentUser.uid] }
      );
    });
    setAdding(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {REACTION_EMOJIS.filter((e) => (reactions[e]?.count ?? 0) > 0).map((e) => {
        const mine = reactions[e]?.uids?.includes(currentUser?.uid);
        return (
          <button key={e} onClick={() => react(e)}
            className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[11px] transition-colors ${
              mine ? "border-teal-300 bg-teal-50 text-teal-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}>
            {e} <span>{reactions[e]?.count}</span>
          </button>
        );
      })}
      <button onClick={() => setAdding((v) => !v)}
        className="rounded-full border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-400 hover:border-slate-300 transition-colors">
        {adding ? "×" : "+"}
      </button>
      {adding && (
        <div className="flex gap-1 flex-wrap">
          {REACTION_EMOJIS.map((e) => (
            <button key={e} onClick={() => react(e)}
              className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-sm hover:bg-slate-50 transition-colors">
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// GAP 1 FIX — WAVE BACK (the "seen" problem)
// ─────────────────────────────────────────────────────────────────

export function WaveBackButton({ db, messageId, senderUid, currentUser }) {
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
    } catch { }
    finally { setWaving(false); }
  };

  if (!currentUser || senderUid === currentUser.uid) return null;
  return (
    <button type="button" onClick={sendWave} disabled={!canWave}
      className={`mt-1 flex items-center gap-1 text-[10px] font-semibold transition-all ${
        waved ? "text-teal-600" : canWave ? "text-slate-300 hover:text-teal-500" : "text-slate-200 cursor-not-allowed"
      }`}>
      {waved ? "👋 waved!" : waving ? "…" : "👋 wave"}
    </button>
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
        const profiles = await Promise.all(unknownUids.map((uid) => getDoc(doc(db, "users", uid))));
        const newNames = {};
        profiles.forEach((p) => {
          if (p.exists()) {
            const data = p.data();
            newNames[p.id] = data.country ? `Someone in ${data.country}` : "Someone";
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
// GAP 2 FIX — MOOD TAG (identity layer)
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

export function MoodPill({ mood, tiny = false }) {
  const found = MOOD_OPTIONS.find((m) => m.id === mood);
  if (!found) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-full border border-slate-200 bg-white text-slate-500 ${
      tiny ? "px-1.5 py-0 text-[9px]" : "px-2 py-0.5 text-[11px]"
    }`}>
      <span style={{ fontSize: tiny ? "9px" : "11px" }}>{found.emoji}</span>
      {!tiny && <span>{found.label}</span>}
    </span>
  );
}

export function MoodSelector({ db, uid, currentMood }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const current = MOOD_OPTIONS.find((m) => m.id === currentMood);

  const selectMood = async (moodId) => {
    if (!db || !uid) return;
    setSaving(true);
    try {
      await setDoc(doc(db, "users", uid), { moodTag: moodId }, { merge: true });
      setOpen(false);
    } finally { setSaving(false); }
  };

  return (
    <div className="mt-2">
      <button onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-xs text-slate-600 hover:bg-slate-100 transition-colors">
        <span className="flex items-center gap-2">
          {current
            ? <><span style={{ fontSize: "13px" }}>{current.emoji}</span><span className="font-medium">{current.label}</span></>
            : <span className="text-slate-400">How are you feeling today?</span>}
        </span>
        <span className="text-slate-400 text-[10px]">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="mt-1 grid grid-cols-4 gap-1.5 rounded-2xl border border-slate-100 bg-white p-2">
          {MOOD_OPTIONS.map((mood) => (
            <button key={mood.id} onClick={() => selectMood(mood.id)} disabled={saving}
              className={`flex flex-col items-center gap-0.5 rounded-xl border py-2 text-[10px] transition-colors ${
                currentMood === mood.id
                  ? "border-teal-300 bg-teal-50 text-teal-700"
                  : "border-slate-100 bg-slate-50 text-slate-600 hover:border-teal-200"
              }`}>
              <span style={{ fontSize: "16px" }}>{mood.emoji}</span>
              <span>{mood.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// GAP 4 FIX — PREMIUM UPGRADE PROMPT (monetization)
// ─────────────────────────────────────────────────────────────────

export function PremiumUpgradePrompt({ onClose }) {
  return (
    <div className="absolute inset-0 z-50 flex items-end justify-center bg-slate-900/30 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-gradient-to-br from-amber-400 to-orange-400 p-2">
              <Sparkles size={16} className="text-white" />
            </div>
            <p className="font-bold text-slate-800">Uplift Premium</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X size={16} /></button>
        </div>
        <p className="text-sm text-slate-600 mb-4">
          Unlock 25+ curated greetings — Warmth, Strength, Calm, Celebrate, and World Moments packs.
        </p>
        <div className="space-y-2 mb-4">
          {["Warmth & strength messages", "Cultural & seasonal greetings", "Calm & reassurance pack", "New packs added monthly"].map((f) => (
            <div key={f} className="flex items-center gap-2 text-sm text-slate-700">
              <CheckCircle2 size={14} className="text-teal-500 shrink-0" />
              {f}
            </div>
          ))}
        </div>
        <button
          onClick={() => alert("Payment integration coming soon!")}
          className="w-full rounded-2xl bg-gradient-to-r from-teal-500 to-emerald-500 py-3 text-sm font-bold text-white hover:opacity-90 transition-opacity">
          Upgrade — $3.99/mo
        </button>
        <p className="mt-2 text-center text-[10px] text-slate-400">Cancel anytime. No ads, ever.</p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// PROFILE CARD (shareable)
// ─────────────────────────────────────────────────────────────────

const LEVEL_THRESHOLDS = [
  { min: 0,   title: "Novice Greeter" },
  { min: 50,  title: "Kindness Scout" },
  { min: 150, title: "Beacon of Hope" },
  { min: 300, title: "Sunshine Bringer" },
  { min: 600, title: "Guardian of Joy" },
];

function getLevelForBalance(balance) {
  return LEVEL_THRESHOLDS.reduce((l, t) => (balance >= t.min ? t : l), LEVEL_THRESHOLDS[0]);
}

export function ProfileCard({ profile, streak, sparkBalance, onClose }) {
  const cardRef = useRef(null);
  const [copying, setCopying] = useState(false);
  const level = getLevelForBalance(sparkBalance);
  const mood = MOOD_OPTIONS.find((m) => m.id === profile?.moodTag);

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
          await navigator.share({ files: [new File([blob], "uplift-card.png", { type: "image/png" })], title: "My Uplift Profile" });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a"); a.href = url; a.download = "uplift-card.png"; a.click();
          URL.revokeObjectURL(url);
        }
      }, "image/png");
    } catch { }
    finally { setCopying(false); }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm">
        <div ref={cardRef} className="rounded-3xl bg-gradient-to-br from-teal-500 to-emerald-400 p-6 text-white shadow-2xl">
          <div className="flex items-center gap-3 mb-4">
            {profile?.profilePhotoUrl
              ? <img src={profile.profilePhotoUrl} alt="" className="h-14 w-14 rounded-full border-2 border-white/40 object-cover" crossOrigin="anonymous" />
              : <div className="h-14 w-14 rounded-full border-2 border-white/40 bg-white/20 flex items-center justify-center text-xl font-bold">{(profile?.fullName ?? "?")[0]}</div>}
            <div>
              <p className="text-lg font-extrabold">{profile?.fullName}</p>
              <p className="text-sm text-white/80">{profile?.country}</p>
              {mood && <p className="text-xs text-white/70 mt-0.5">{mood.emoji} {mood.label}</p>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-2xl bg-white/20 p-3 text-center">
              <Flame size={16} className="mx-auto mb-1 text-orange-200" />
              <p className="text-xl font-extrabold">{streak ?? 0}</p>
              <p className="text-[10px] text-white/70">day streak</p>
            </div>
            <div className="rounded-2xl bg-white/20 p-3 text-center">
              <Sparkles size={16} className="mx-auto mb-1 text-yellow-200" />
              <p className="text-xl font-extrabold">{sparkBalance}</p>
              <p className="text-[10px] text-white/70">sparks</p>
            </div>
            <div className="rounded-2xl bg-white/20 p-3 text-center">
              <Star size={16} className="mx-auto mb-1 text-white/80" />
              <p className="text-[11px] font-extrabold leading-tight">{level.title}</p>
              <p className="text-[10px] text-white/70">level</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2">
            <Heart size={12} className="text-pink-200" />
            <p className="text-xs text-white/90">Spreading positivity with Uplift 🌟</p>
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={handleShare} disabled={copying}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white py-3 text-sm font-semibold text-teal-700 hover:bg-teal-50 transition-colors">
            <Share2 size={14} />
            {copying ? "Preparing…" : "Share / Save"}
          </button>
          <button onClick={onClose}
            className="rounded-2xl border border-white/30 bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
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
    new Notification("Uplift 🌟", { body: "Your daily greeting window is open — spread some kindness!", icon: "/icons/icon-192.png" });
  }, msUntil);
  return () => clearTimeout(id);
}

export function NotificationPermissionBanner() {
  const [status, setStatus] = useState(typeof Notification !== "undefined" ? Notification.permission : "denied");
  const [dismissed, setDismissed] = useState(false);
  if (status === "granted" || status === "denied" || dismissed) return null;
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
      <div className="flex items-center gap-2">
        <Bell size={12} className="text-blue-500 shrink-0" />
        <span>Enable daily reminders to keep your streak alive.</span>
      </div>
      <div className="flex gap-2 shrink-0">
        <button onClick={async () => setStatus(await Notification.requestPermission())}
          className="rounded-lg bg-blue-600 px-2 py-1 text-white font-semibold hover:bg-blue-700 transition-colors">Enable</button>
        <button onClick={() => setDismissed(true)} className="text-blue-400 hover:text-blue-600"><X size={12} /></button>
      </div>
    </div>
  );
}
