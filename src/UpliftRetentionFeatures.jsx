import React, {
  createContext,
  useCallback,
  useContext,
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
  orderBy,
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
  Flame,
  Gift,
  Heart,
  Sparkles,
  Star,
  Users,
  Shield,
  Share2,
  Bell,
  CheckCircle2,
  X,
  Plus,
  Zap,
} from "lucide-react";
 
// ─────────────────────────────────────────────────────────────────
// 0. SHARED HELPERS
// ─────────────────────────────────────────────────────────────────
 
/** Returns "YYYY-MM-DD" for today in the user's local timezone. */
export function todayKey() {
  return new Date().toISOString().slice(0, 10);
}
 
/**
 * Mystery pool – rotating weekly bonuses.
 * Each entry: { id, label, sparkReward, emoji }
 * The active one is selected by ISO week number so it changes every Monday.
 */
export const MYSTERY_POOL = [
  { id: "m1", label: "Double Joy", sparkReward: 50, emoji: "✨" },
  { id: "m2", label: "Kind Surge",  sparkReward: 40, emoji: "💛" },
  { id: "m3", label: "Sunshine Burst", sparkReward: 35, emoji: "☀️" },
  { id: "m4", label: "Midnight Magic", sparkReward: 45, emoji: "🌙" },
];
 
function isoWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}
 
/** Returns the mystery pool item active this week. */
export function thisWeeksMystery() {
  return MYSTERY_POOL[isoWeek() % MYSTERY_POOL.length];
}
 
/**
 * Computes the final spark reward for a greeting, applying the streak multiplier.
 *
 * streakDays: current streak length
 * baseReward: greeting.sparkReward
 */
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
//
// INTEGRATION in App.jsx:
//
//   const { streak, freezesAvailable, recordGreetingDay, useFreeze } =
//     useStreak(db, currentUser?.uid, profile);
//
//   // Pass streak to computeSparkReward inside handleSendMessage:
//   const reward = computeSparkReward(greeting.sparkReward, streak);
//
//   // After the transaction in handleSendMessage:
//   await recordGreetingDay();
//
//   // In the header, next to the spark balance badge:
//   <StreakBadge streak={streak} />
//   <StreakFreezeButton
//     freezes={freezesAvailable}
//     sparkBalance={sparkBalance}
//     onBuy={() => useFreeze()}   // or show a confirm first
//   />
 
const FREEZE_COST = 10; // sparks
 
/**
 * useStreak – manages streak state in Firestore.
 *
 * Stored at users/{uid}:
 *   streakDays        number
 *   lastGreetingDate  "YYYY-MM-DD"
 *   streakFreezes     number   (purchased freeze tokens)
 *   lastFreezeUsed    "YYYY-MM-DD"
 */
export function useStreak(db, uid, profile) {
  const [streak, setStreak] = useState(0);
  const [freezesAvailable, setFreezesAvailable] = useState(0);
 
  // Sync from profile snapshot (already live in App.jsx)
  useEffect(() => {
    if (!profile) return;
    setStreak(Number(profile.streakDays ?? 0));
    setFreezesAvailable(Number(profile.streakFreezes ?? 0));
  }, [profile]);
 
  /**
   * Call after a successful greeting send.
   * Increments streak if the user greeted yesterday or today,
   * resets to 1 otherwise.
   */
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
      const yesterdayKey = yesterday.toISOString().slice(0, 10);
 
      let newStreak = 1;
      if (lastDate === today) {
        newStreak = currentStreak; // already counted today
      } else if (lastDate === yesterdayKey) {
        newStreak = currentStreak + 1;
      }
 
      tx.set(userRef, { streakDays: newStreak, lastGreetingDate: today }, { merge: true });
    });
  }, [db, uid]);
 
  /**
   * Purchase a streak freeze using sparks.
   * Returns { ok } or { error }.
   */
  const buyFreeze = useCallback(async () => {
    if (!db || !uid) return { error: "Not signed in." };
    const userRef = doc(db, "users", uid);
 
    try {
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(userRef);
        const data = snap.exists() ? snap.data() : {};
        const balance = Number(data.sparkBalance ?? 0);
 
        if (balance < FREEZE_COST) throw new Error("insufficient_sparks");
 
        tx.set(
          userRef,
          {
            sparkBalance: balance - FREEZE_COST,
            streakFreezes: Number(data.streakFreezes ?? 0) + 1,
          },
          { merge: true }
        );
      });
      return { ok: true };
    } catch (e) {
      return { error: e.message === "insufficient_sparks" ? "Not enough sparks." : "Failed." };
    }
  }, [db, uid]);
 
  /**
   * Use one freeze to protect today's streak from breaking.
   */
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
 
        tx.set(
          userRef,
          {
            streakFreezes: freezes - 1,
            lastGreetingDate: yKey, // pretend they greeted yesterday
            lastFreezeUsed: today,
          },
          { merge: true }
        );
      });
      return { ok: true };
    } catch (e) {
      return { error: e.message === "no_freezes" ? "No freezes left." : "Failed." };
    }
  }, [db, uid]);
 
  return { streak, freezesAvailable, recordGreetingDay, buyFreeze, useFreeze };
}
 
/** Flame badge showing current streak. */
export function StreakBadge({ streak }) {
  if (!streak || streak < 1) return null;
  const hot = streak >= 7;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold border ${
        hot
          ? "bg-orange-50 border-orange-200 text-orange-700"
          : "bg-slate-50 border-slate-200 text-slate-600"
      }`}
    >
      <Flame size={12} className={hot ? "text-orange-500" : "text-slate-400"} />
      {streak}d
    </span>
  );
}
 
/** Button to buy a streak freeze for 10 sparks. */
export function StreakFreezeButton({ freezes, sparkBalance, onBuy }) {
  const canAfford = sparkBalance >= FREEZE_COST;
  return (
    <button
      type="button"
      onClick={onBuy}
      disabled={!canAfford}
      title={freezes > 0 ? `You have ${freezes} freeze(s)` : `Buy a streak freeze for ${FREEZE_COST} sparks`}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
        freezes > 0
          ? "border-cyan-200 bg-cyan-50 text-cyan-700"
          : canAfford
          ? "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
          : "border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed"
      }`}
    >
      <Shield size={11} />
      {freezes > 0 ? `${freezes} freeze` : `Freeze (${FREEZE_COST}✨)`}
    </button>
  );
}
 
// ─────────────────────────────────────────────────────────────────
// 2. KINDNESS PLEDGE
// ─────────────────────────────────────────────────────────────────
//
// INTEGRATION in App.jsx:
//
//   // In the main authenticated view, above the chat:
//   <KindnessPledge
//     db={db}
//     uid={currentUser.uid}
//     todayMessageCount={messages.filter(m => m.uid === currentUser.uid &&
//       m.timestamp > startOfToday()).length}
//   />
 
function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}
 
/**
 * Stores pledge at users/{uid}/pledges/{YYYY-MM-DD}
 *   { target: number, completedAt?: timestamp }
 */
export function KindnessPledge({ db, uid, todayMessageCount = 0 }) {
  const [target, setTarget] = useState(null);  // null = no pledge yet
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
      setTarget(n);
      setPicking(false);
    } finally {
      setSaving(false);
    }
  };
 
  if (loading) return null;
 
  const fulfilled = target !== null && todayMessageCount >= target;
  const remaining = target !== null ? Math.max(0, target - todayMessageCount) : null;
 
  if (target === null && !picking) {
    return (
      <button
        onClick={() => setPicking(true)}
        className="flex w-full items-center gap-2 rounded-2xl border border-dashed border-teal-300 bg-teal-50/60 px-4 py-2.5 text-sm text-teal-700 hover:bg-teal-50 transition-colors"
      >
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
            <button
              key={n}
              disabled={saving}
              onClick={() => savePledge(n)}
              className="flex-1 rounded-xl border border-teal-300 bg-white py-2 text-sm font-bold text-teal-700 hover:bg-teal-100 transition-colors"
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    );
  }
 
  return (
    <div
      className={`flex items-center justify-between rounded-2xl border px-4 py-2.5 text-sm transition-colors ${
        fulfilled
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-amber-200 bg-amber-50 text-amber-800"
      }`}
    >
      <span className="flex items-center gap-2">
        <CheckCircle2 size={14} className={fulfilled ? "text-emerald-500" : "text-amber-500"} />
        {fulfilled
          ? `Pledge complete! ${todayMessageCount}/${target} greetings ✨`
          : `Pledge: ${todayMessageCount}/${target} greetings — ${remaining} to go`}
      </span>
    </div>
  );
}
 
// ─────────────────────────────────────────────────────────────────
// 3. UPLIFT BUDDIES + SPARK GIFTING
// ─────────────────────────────────────────────────────────────────
//
// INTEGRATION in App.jsx:
//
//   // Add a "Buddies" tab or collapsible section in the header or sidebar:
//   <BuddyPanel db={db} currentUser={currentUser} profile={profile} />
//
//   // In the message bubble for non-self messages, add:
//   <SparkGiftButton
//     db={db}
//     senderUid={m.uid}
//     currentUser={currentUser}
//     profile={profile}
//   />
 
const GIFT_AMOUNT = 5;
 
/**
 * BuddyPanel – shows up to 5 buddies.
 * Buddies are stored in users/{uid}.buddies as an array of UIDs.
 * We display them by fetching their profile docs.
 */
export function BuddyPanel({ db, currentUser, profile }) {
  const [buddyProfiles, setBuddyProfiles] = useState([]);
  const [addOpen, setAddOpen] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [searching, setSearching] = useState(false);
 
  const buddyUids = profile?.buddies ?? [];
 
  // Load buddy profiles
  useEffect(() => {
    if (!db || buddyUids.length === 0) { setBuddyProfiles([]); return; }
    const load = async () => {
      const docs = await Promise.all(
        buddyUids.slice(0, 5).map((uid) => getDoc(doc(db, "users", uid)))
      );
      setBuddyProfiles(
        docs.filter((d) => d.exists()).map((d) => ({ uid: d.id, ...d.data() }))
      );
    };
    load();
  }, [db, JSON.stringify(buddyUids)]);
 
  const searchForUser = async () => {
    if (!db || !searchEmail.trim()) return;
    setSearching(true);
    setSearchError("");
    setSearchResult(null);
    try {
      const q = query(
        collection(db, "users"),
        where("email", "==", searchEmail.trim().toLowerCase()),
        limit(1)
      );
      const snap = await getDocs(q);
      if (snap.empty) {
        setSearchError("No user found with that email.");
      } else {
        const d = snap.docs[0];
        setSearchResult({ uid: d.id, ...d.data() });
      }
    } catch {
      setSearchError("Search failed. Try again.");
    } finally {
      setSearching(false);
    }
  };
 
  const addBuddy = async (targetUid) => {
    if (!db || !currentUser) return;
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, { buddies: arrayUnion(targetUid) });
    setAddOpen(false);
    setSearchResult(null);
    setSearchEmail("");
  };
 
  const removeBuddy = async (targetUid) => {
    if (!db || !currentUser) return;
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, { buddies: arrayRemove(targetUid) });
  };
 
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3 mt-2">
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-1.5 text-xs font-bold text-slate-600 uppercase tracking-wide">
          <Users size={12} /> Uplift Buddies
        </span>
        {buddyUids.length < 5 && (
          <button
            onClick={() => setAddOpen((v) => !v)}
            className="rounded-full border border-slate-200 p-0.5 hover:bg-slate-200 transition-colors"
          >
            <Plus size={13} className="text-slate-500" />
          </button>
        )}
      </div>
 
      {buddyProfiles.length === 0 && !addOpen && (
        <p className="text-[11px] text-slate-400">Add up to 5 buddies to see their greetings first.</p>
      )}
 
      <div className="space-y-1.5">
        {buddyProfiles.map((b) => (
          <div key={b.uid} className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {b.profilePhotoUrl ? (
                <img src={b.profilePhotoUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
              ) : (
                <div className="h-6 w-6 rounded-full bg-teal-100 flex items-center justify-center text-[10px] font-bold text-teal-700">
                  {(b.fullName ?? "?")[0]}
                </div>
              )}
              <span className="text-xs text-slate-700">{b.fullName}</span>
            </div>
            <button
              onClick={() => removeBuddy(b.uid)}
              className="text-slate-300 hover:text-rose-400 transition-colors"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
 
      {addOpen && (
        <div className="mt-2 space-y-1.5">
          <input
            value={searchEmail}
            onChange={(e) => setSearchEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && searchForUser()}
            placeholder="Friend's email…"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400"
          />
          <button
            onClick={searchForUser}
            disabled={searching}
            className="w-full rounded-xl bg-teal-600 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 transition-colors"
          >
            {searching ? "Searching…" : "Search"}
          </button>
          {searchError && <p className="text-[11px] text-rose-500">{searchError}</p>}
          {searchResult && searchResult.uid !== currentUser?.uid && (
            <div className="flex items-center justify-between rounded-xl border border-teal-200 bg-white px-3 py-2">
              <span className="text-xs text-slate-700">{searchResult.fullName}</span>
              <button
                onClick={() => addBuddy(searchResult.uid)}
                className="text-xs font-semibold text-teal-600 hover:text-teal-800"
              >
                Add
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
 
/**
 * SparkGiftButton – shown on other users' messages.
 * Gifts GIFT_AMOUNT sparks from the current user to the message sender.
 *
 * INTEGRATION: render inside the message bubble for non-self messages:
 *   {!mine && (
 *     <SparkGiftButton
 *       db={db}
 *       senderUid={m.uid}
 *       currentUser={currentUser}
 *       profile={profile}
 *     />
 *   )}
 */
export function SparkGiftButton({ db, senderUid, currentUser, profile }) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);
 
  const canGift =
    !sent &&
    !sending &&
    currentUser &&
    senderUid &&
    senderUid !== currentUser.uid &&
    Number(profile?.sparkBalance ?? 0) >= GIFT_AMOUNT;
 
  const sendGift = async () => {
    if (!canGift || !db) return;
    setSending(true);
    try {
      const senderRef = doc(db, "users", currentUser.uid);
      const receiverRef = doc(db, "users", senderUid);
 
      await runTransaction(db, async (tx) => {
        const [sSnap, rSnap] = await Promise.all([tx.get(senderRef), tx.get(receiverRef)]);
        const sBalance = Number(sSnap.exists() ? sSnap.data().sparkBalance ?? 0 : 0);
        if (sBalance < GIFT_AMOUNT) throw new Error("insufficient");
        const rBalance = Number(rSnap.exists() ? rSnap.data().sparkBalance ?? 0 : 0);
        tx.set(senderRef, { sparkBalance: sBalance - GIFT_AMOUNT }, { merge: true });
        tx.set(receiverRef, { sparkBalance: rBalance + GIFT_AMOUNT }, { merge: true });
      });
 
      setSent(true);
    } catch {
      // silently fail – not critical
    } finally {
      setSending(false);
    }
  };
 
  if (!currentUser || senderUid === currentUser.uid) return null;
 
  return (
    <button
      type="button"
      onClick={sendGift}
      disabled={!canGift}
      title={sent ? "Gift sent!" : `Gift ${GIFT_AMOUNT} sparks`}
      className={`mt-1 flex items-center gap-1 text-[10px] font-semibold transition-colors ${
        sent
          ? "text-amber-600"
          : canGift
          ? "text-slate-400 hover:text-amber-500"
          : "text-slate-300 cursor-not-allowed"
      }`}
    >
      <Gift size={10} />
      {sent ? `+${GIFT_AMOUNT} gifted!` : sending ? "…" : `Gift ${GIFT_AMOUNT}✨`}
    </button>
  );
}
 
// ─────────────────────────────────────────────────────────────────
// 4. SOCIAL PRESENCE – LIVE GREETER COUNT + EMOJI REACTIONS
// ─────────────────────────────────────────────────────────────────
//
// INTEGRATION in App.jsx:
//
//   // In the header status bar:
//   <LiveGreeterCount db={db} currentUser={currentUser} />
//
//   // In the message bubble (both mine and others):
//   <MessageReactions db={db} messageId={m.id} currentUser={currentUser} />
 
const PRESENCE_COLLECTION = "presence";
const PRESENCE_TTL_MS = 5 * 60 * 1000; // 5 minutes
 
/**
 * LiveGreeterCount – tracks who's active.
 * Writes a presence doc at presence/{uid} with lastSeen timestamp.
 * Counts docs updated within PRESENCE_TTL_MS.
 */
export function LiveGreeterCount({ db, currentUser }) {
  const [count, setCount] = useState(1);
 
  // Heartbeat: write own presence every 60 s
  useEffect(() => {
    if (!db || !currentUser) return;
    const presenceRef = doc(db, PRESENCE_COLLECTION, currentUser.uid);
    const write = () =>
      setDoc(presenceRef, { lastSeen: Date.now(), uid: currentUser.uid }, { merge: true }).catch(() => {});
    write();
    const id = setInterval(write, 60_000);
    return () => clearInterval(id);
  }, [db, currentUser]);
 
  // Listen and count active presences
  useEffect(() => {
    if (!db) return;
    const cutoff = Date.now() - PRESENCE_TTL_MS;
    const q = query(
      collection(db, PRESENCE_COLLECTION),
      where("lastSeen", ">=", cutoff)
    );
    const unsub = onSnapshot(q, (snap) => setCount(snap.size), () => {});
    return unsub;
  }, [db]);
 
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
      {count} greeting{count !== 1 ? "s" : ""} now
    </span>
  );
}
 
/**
 * MessageReactions – emoji reaction row below a message.
 *
 * Stored at publicMessages/{messageId}/reactions/{emoji}
 *   { count: number, uids: string[] }
 *
 * INTEGRATION: add below <p>{m.text}</p> in the message bubble.
 */
const REACTION_EMOJIS = ["❤️", "🌟", "🙏", "😊", "✨"];
 
export function MessageReactions({ db, messageId, currentUser }) {
  const [reactions, setReactions] = useState({});
  const [adding, setAdding] = useState(false);
 
  useEffect(() => {
    if (!db || !messageId) return;
    const reactionsRef = collection(db, "publicMessages", messageId, "reactions");
    const unsub = onSnapshot(reactionsRef, (snap) => {
      const r = {};
      snap.forEach((d) => { r[d.id] = d.data(); });
      setReactions(r);
    }, () => {});
    return unsub;
  }, [db, messageId]);
 
  const react = async (emoji) => {
    if (!db || !currentUser || !messageId) return;
    const rRef = doc(db, "publicMessages", messageId, "reactions", emoji);
    await runTransaction(db, async (tx) => {
      const snap = await tx.get(rRef);
      const data = snap.exists() ? snap.data() : { count: 0, uids: [] };
      const uids = data.uids ?? [];
      const alreadyReacted = uids.includes(currentUser.uid);
      if (alreadyReacted) {
        tx.set(rRef, {
          count: Math.max(0, (data.count ?? 0) - 1),
          uids: uids.filter((u) => u !== currentUser.uid),
        });
      } else {
        tx.set(rRef, {
          count: (data.count ?? 0) + 1,
          uids: [...uids, currentUser.uid],
        });
      }
    });
    setAdding(false);
  };
 
  const hasReactions = Object.values(reactions).some((r) => (r.count ?? 0) > 0);
 
  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {REACTION_EMOJIS.filter((e) => (reactions[e]?.count ?? 0) > 0).map((e) => {
        const mine = reactions[e]?.uids?.includes(currentUser?.uid);
        return (
          <button
            key={e}
            onClick={() => react(e)}
            className={`flex items-center gap-0.5 rounded-full border px-1.5 py-0.5 text-[11px] transition-colors ${
              mine
                ? "border-teal-300 bg-teal-50 text-teal-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            {e} <span>{reactions[e]?.count}</span>
          </button>
        );
      })}
      <button
        onClick={() => setAdding((v) => !v)}
        className="rounded-full border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-400 hover:border-slate-300 transition-colors"
      >
        {adding ? "×" : "+"}
      </button>
      {adding && (
        <div className="flex gap-1 flex-wrap">
          {REACTION_EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => react(e)}
              className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-sm hover:bg-slate-50 transition-colors"
            >
              {e}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
 
// ─────────────────────────────────────────────────────────────────
// 5. SHAREABLE PROFILE CARD
// ─────────────────────────────────────────────────────────────────
//
// INTEGRATION in App.jsx:
//
//   const [showProfileCard, setShowProfileCard] = useState(false);
//
//   // Trigger button in header:
//   <button onClick={() => setShowProfileCard(true)}>
//     <Share2 size={14} /> Share
//   </button>
//
//   // Overlay:
//   {showProfileCard && (
//     <ProfileCard
//       profile={profile}
//       streak={streak}
//       currentLevel={currentLevel}
//       sparkBalance={sparkBalance}
//       onClose={() => setShowProfileCard(false)}
//     />
//   )}
 
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
 
/**
 * ProfileCard – a shareable card overlay.
 * Uses html2canvas (CDN) to let users screenshot/share.
 */
export function ProfileCard({ profile, streak, sparkBalance, onClose }) {
  const cardRef = useRef(null);
  const [copying, setCopying] = useState(false);
  const level = getLevelForBalance(sparkBalance);
 
  const handleShare = async () => {
    setCopying(true);
    try {
      // Dynamically load html2canvas if not already present
      if (!window.html2canvas) {
        await new Promise((resolve, reject) => {
          const s = document.createElement("script");
          s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      const canvas = await window.html2canvas(cardRef.current, { scale: 2, useCORS: true });
      canvas.toBlob(async (blob) => {
        if (navigator.share && blob) {
          await navigator.share({
            files: [new File([blob], "uplift-card.png", { type: "image/png" })],
            title: "My Uplift Profile",
          });
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "uplift-card.png";
          a.click();
          URL.revokeObjectURL(url);
        }
      }, "image/png");
    } catch {
      // fallback: just close
    } finally {
      setCopying(false);
    }
  };
 
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm">
        {/* The shareable card */}
        <div
          ref={cardRef}
          className="rounded-3xl bg-gradient-to-br from-teal-500 to-emerald-400 p-6 text-white shadow-2xl"
        >
          <div className="flex items-center gap-3 mb-4">
            {profile?.profilePhotoUrl ? (
              <img
                src={profile.profilePhotoUrl}
                alt=""
                className="h-14 w-14 rounded-full border-2 border-white/40 object-cover"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="h-14 w-14 rounded-full border-2 border-white/40 bg-white/20 flex items-center justify-center text-xl font-bold">
                {(profile?.fullName ?? "?")[0]}
              </div>
            )}
            <div>
              <p className="text-lg font-extrabold">{profile?.fullName}</p>
              <p className="text-sm text-white/80">{profile?.country}</p>
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
 
        {/* Controls */}
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleShare}
            disabled={copying}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-white py-3 text-sm font-semibold text-teal-700 hover:bg-teal-50 transition-colors"
          >
            <Share2 size={14} />
            {copying ? "Preparing…" : "Share / Save"}
          </button>
          <button
            onClick={onClose}
            className="rounded-2xl border border-white/30 bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/20 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
 
// ─────────────────────────────────────────────────────────────────
// 6. GENTLE NUDGES – GREETING WINDOW NOTIFICATION HELPER
// ─────────────────────────────────────────────────────────────────
//
// INTEGRATION in App.jsx:
//
//   // Call once after the user completes onboarding / on every mount:
//   useEffect(() => {
//     if (isRealSignedInUser && hasCompletedOnboarding) {
//       scheduleGreetingWindowNotification(profile);
//     }
//   }, [isRealSignedInUser, hasCompletedOnboarding]);
//
//   // Show the permission prompt in your header or a banner:
//   <NotificationPermissionBanner />
 
/**
 * Schedules a Web Push notification reminder.
 * Learns the user's typical greeting hour from profile.lastGreetingAt (ms).
 * Falls back to 08:00 if no data yet.
 *
 * NOTE: This uses the Notifications API.  For full PWA push you would
 * additionally need a service worker + VAPID keys.  This helper fires
 * in-tab reminders via setTimeout for immediate value without that setup.
 */
export function scheduleGreetingWindowNotification(profile) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
 
  const now = new Date();
  const lastMs = profile?.lastGreetingAt ?? null;
 
  // Determine target hour: use last greeting's hour or default to 8am
  let targetHour = 8;
  if (lastMs) {
    const lastDate = new Date(lastMs);
    targetHour = lastDate.getHours();
  }
 
  // Schedule for today if the window hasn't passed; tomorrow otherwise
  const target = new Date(now);
  target.setHours(targetHour, 0, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
 
  const msUntil = target.getTime() - now.getTime();
 
  // Cap at 23 h to avoid runaway timers
  if (msUntil > 23 * 60 * 60 * 1000) return;
 
  const timerId = setTimeout(() => {
    new Notification("Uplift 🌟", {
      body: "Your daily greeting window is open — spread some kindness!",
      icon: "/icons/icon-192.png",
    });
  }, msUntil);
 
  // Return cleanup
  return () => clearTimeout(timerId);
}
 
/** Banner to request notification permission. */
export function NotificationPermissionBanner() {
  const [status, setStatus] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "denied"
  );
  const [dismissed, setDismissed] = useState(false);
 
  if (status === "granted" || status === "denied" || dismissed) return null;
 
  const request = async () => {
    const result = await Notification.requestPermission();
    setStatus(result);
  };
 
  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
      <div className="flex items-center gap-2">
        <Bell size={12} className="text-blue-500 shrink-0" />
        <span>Enable daily reminders to keep your streak alive.</span>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={request}
          className="rounded-lg bg-blue-600 px-2 py-1 text-white font-semibold hover:bg-blue-700 transition-colors"
        >
          Enable
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="text-blue-400 hover:text-blue-600"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
