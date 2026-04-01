import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, Bell, Calendar, ChevronDown, Globe,
  Loader2, Mail, LogOut, Send, Sparkles, Gift, User, Share2, Shield, X,
} from "lucide-react";
import WorldMap from "./WorldMap";
import { AnimationLayer, useAnimations, useSparkCounter, useProgressBarFill,
  MessageSlideIn, SendingIndicator, GreetingSheetWrapper, MapTransitionWrapper,
  CountryReveal, LiveCountTick, StreakBadgeWithPulse,
  ReactionBurstLayer, useReactionBurst } from "./MicroAnimations";

import ProfilePhotoStep from "./ProfilePhotoStep";
import SignInStep from "./SignInStep";
import WelcomeStep from "./WelcomeStep";

import {
  useStreak, computeSparkReward,
  StreakBadge, StreakFreezeButton,
  KindnessPledge, BuddyPanel, SparkGiftButton,
  LiveGreeterCount, MessageReactions,
  ProfileCard,
  WaveBackButton, ReactionSideBadges,
  MoodSelector, MoodPill,
  PremiumUpgradePrompt,
  scheduleGreetingWindowNotification,
  NotificationPermissionBanner,
} from "./UpliftRetentionFeatures";

import { getGreetingsByCategory, getAccessibleGreetings } from "./greetings";

import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider, getAuth, onAuthStateChanged, signOut,
  signInWithPopup, signInWithRedirect, sendSignInLinkToEmail,
  isSignInWithEmailLink, signInWithEmailLink,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, updateProfile as updateAuthProfile,
} from "firebase/auth";

import {
  addDoc, collection, doc, getFirestore,
  limit, onSnapshot, orderBy, query,
  runTransaction, serverTimestamp, setDoc, where,
} from "firebase/firestore";

import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBSez1kAaFXKZzM97E9y4HhDiqE3tRAeLE",
  authDomain: "uplift-6d9ea.firebaseapp.com",
  projectId: "uplift-6d9ea",
  storageBucket: "uplift-6d9ea.firebasestorage.app",
  messagingSenderId: "821891105119",
  appId: "1:821891105119:web:6245f2bc4c8c8ee96976ea",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const YEARS = Array.from({ length: 100 }, (_, i) => String(new Date().getFullYear() - i));

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

const LEVEL_THRESHOLDS = [
  { min: 0,   title: "Novice Greeter" },
  { min: 50,  title: "Kindness Scout" },
  { min: 150, title: "Beacon of Hope" },
  { min: 300, title: "Sunshine Bringer" },
  { min: 600, title: "Guardian of Joy" },
];

const nowMs = () => Date.now();
const normalizeEmail = (email = "") => email.trim().toLowerCase();

function startOfToday() {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime();
}

function InputRow({ icon, children, rightIcon = null }) {
  const Icon = icon;
  return (
    <div className="relative">
      <Icon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
      {children}
      {rightIcon}
    </div>
  );
}

function MeatballMenu({ onWorld, onShare, onSignOut, isSigningOut, globePulse, db, currentUser, profile }) {
  const [open, setOpen] = useState(false);
  const [showBuddies, setShowBuddies] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 active:scale-90 transition-all"
        aria-label="More options">
        <span className="text-lg leading-none tracking-widest">···</span>
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-50 min-w-[175px] rounded-2xl border border-slate-100 bg-white py-1.5 shadow-xl">
          <button onClick={() => { onWorld(); setOpen(false); }}
            className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
            <span>{globePulse ? "🌍" : "🌐"}</span> World Map
          </button>
          <button onClick={() => { onShare(); setOpen(false); }}
            className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
            <span>👤</span> My Profile
          </button>
          <button onClick={() => setShowBuddies((v) => !v)}
            className="flex w-full items-center justify-between gap-2.5 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors">
            <span className="flex items-center gap-2.5"><span>🤝</span> Uplift Buddies</span>
            <span className="text-slate-400 text-xs">{showBuddies ? "▲" : "▼"}</span>
          </button>
          {showBuddies && (
            <div className="mx-2 mb-1 rounded-xl border border-slate-100 bg-slate-50 px-2 py-1">
              <BuddyPanel db={db} currentUser={currentUser} profile={profile} compact />
            </div>
          )}
          <div className="my-1 border-t border-slate-100" />
          <button onClick={() => { onSignOut(); setOpen(false); }} disabled={isSigningOut}
            className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50">
            <span>🚪</span> {isSigningOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}

const REACTION_LABEL_BELL = { "❤️": "loved your message", "🙏": "thanked you", "😊": "made them smile", "🌟": "called you a star" };

function NotificationBell({ streak, db, currentUser }) {
  const [open, setOpen] = useState(false);
  const [waves, setWaves] = useState([]);
  const [reactions, setReactions] = useState([]);
  const [dismissedReactions, setDismissedReactions] = useState(new Set());
  const ref = useRef(null);

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (!db || !currentUser) return;
    const q = query(collection(db, "waves"), where("toUid", "==", currentUser.uid), where("read", "==", false), limit(10));
    return onSnapshot(q, (snap) => {
      setWaves(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => {});
  }, [db, currentUser]);

  useEffect(() => {
    if (!db || !currentUser) return;
    const q = query(collection(db, "publicMessages"), where("uid", "==", currentUser.uid), orderBy("timestamp", "desc"), limit(20));
    let innerUnsubs = [];
    const outer = onSnapshot(q, (snap) => {
      innerUnsubs.forEach((u) => u());
      innerUnsubs = [];
      const acc = {};
      snap.docs.forEach(({ id: msgId, data }) => {
        const text = data().text;
        const unsub = onSnapshot(collection(db, "publicMessages", msgId, "reactions"), (rSnap) => {
          rSnap.forEach((rDoc) => {
            const count = rDoc.data().count ?? 0;
            if (count > 0) acc[`${msgId}:${rDoc.id}`] = { key: `${msgId}:${rDoc.id}`, msgId, text, emoji: rDoc.id, count };
            else delete acc[`${msgId}:${rDoc.id}`];
          });
          setReactions(Object.values(acc).slice(0, 8));
        }, () => {});
        innerUnsubs.push(unsub);
      });
    }, () => {});
    return () => { outer(); innerUnsubs.forEach((u) => u()); };
  }, [db, currentUser]);

  const dismissWave = async (id) => {
    if (!db) return;
    await setDoc(doc(db, "waves", id), { read: true }, { merge: true }).catch(() => {});
  };
  const dismissAllWaves = () => waves.forEach((w) => dismissWave(w.id));
  const dismissReaction = (key) => setDismissedReactions((s) => new Set(s).add(key));

  const visibleReactions = reactions.filter((r) => !dismissedReactions.has(r.key));
  const totalUnread = waves.length + visibleReactions.length;
  const hot = streak >= 7;

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)}
        className="relative flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 active:scale-90 transition-all">
        <Bell size={18} />
        {totalUnread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-80 rounded-2xl border border-slate-100 bg-white shadow-xl overflow-hidden">
          <div className={`flex items-center gap-2 px-4 py-3 ${hot ? "bg-orange-50" : "bg-slate-50"} border-b border-slate-100`}>
            <span className="text-lg">{hot ? "🔥" : "✨"}</span>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-slate-800">
                {streak > 0 ? `${streak}-day kindness streak!` : "Start your kindness streak"}
              </p>
              <p className="text-[10px] text-slate-500">
                {streak >= 3 ? `+${streak >= 30 ? 100 : streak >= 14 ? 75 : streak >= 7 ? 50 : 25}% spark bonus active` : "Send a greeting today to begin"}
              </p>
            </div>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {waves.length === 0 && visibleReactions.length === 0 ? (
              <p className="px-4 py-6 text-center text-[11px] text-slate-400">No new notifications</p>
            ) : (
              <div className="py-1">
                {waves.map((w) => (
                  <div key={w.id} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50">
                    <span className="text-base flex-shrink-0">👋</span>
                    <p className="flex-1 text-[11px] text-slate-700">Someone waved at you!</p>
                    <button onClick={() => dismissWave(w.id)}
                      className="flex-shrink-0 flex h-6 w-6 items-center justify-center text-slate-300 hover:text-slate-500">
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {waves.length > 0 && visibleReactions.length > 0 && (
                  <div className="mx-4 my-1 border-t border-slate-100" />
                )}
                {visibleReactions.map(({ key, text, emoji, count }) => {
                  const label = REACTION_LABEL_BELL[emoji] ?? "reacted to your message";
                  const short = text.length > 22 ? text.slice(0, 22) + "…" : text;
                  return (
                    <div key={key} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50">
                      <span className="text-base flex-shrink-0">{emoji}</span>
                      <p className="flex-1 text-[11px] text-slate-700 min-w-0">
                        <span className="font-semibold">{count} {count === 1 ? "person" : "people"}</span>
                        {" "}{label}
                        <span className="text-slate-400 block truncate">&ldquo;{short}&rdquo;</span>
                      </p>
                      <button onClick={() => dismissReaction(key)}
                        className="flex-shrink-0 flex h-6 w-6 items-center justify-center text-slate-300 hover:text-slate-500">
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {(waves.length > 1 || visibleReactions.length > 0) && (
            <div className="border-t border-slate-100 px-4 py-2">
              <button
                onClick={() => { dismissAllWaves(); visibleReactions.forEach((r) => dismissReaction(r.key)); }}
                className="w-full text-center text-[10px] font-semibold text-slate-400 hover:text-slate-600">
                Clear all
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Onboarding({ onContinue, loading, initialData = null, errorMessage = "", initialEmail = "" }) {
  const [form, setForm] = useState({ country: "", fullName: "", email: "", dobMonth: "", dobDay: "", dobYear: "" });

  useEffect(() => {
    const [dobMonth = "", dobDay = "", dobYear = ""] = (initialData?.dob || "").replace(",", "").split(" ");
    setForm((prev) => ({
      ...prev,
      country: initialData?.country || "",
      fullName: initialData?.fullName || "",
      email: initialEmail || initialData?.email || "",
      dobMonth, dobDay, dobYear,
    }));
  }, [initialData, initialEmail]);

  const valid = Boolean(form.country) && Boolean(form.fullName) && Boolean(form.email)
    && Boolean(form.dobMonth) && Boolean(form.dobDay) && Boolean(form.dobYear);

  const onChange = (e) => { const { name, value } = e.target; setForm((prev) => ({ ...prev, [name]: value })); };

  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-teal-600" /></div>;

  return (
    <div className="h-full w-full bg-gradient-to-b from-[#edf5f6] via-[#f7f7f6] to-[#f6f5f2] px-6 pt-8 pb-6">
      <form className="mx-auto w-full max-w-sm space-y-3"
        onSubmit={(e) => { e.preventDefault(); if (!valid) return; onContinue({ ...form, dob: `${form.dobMonth} ${form.dobDay}, ${form.dobYear}` }); }}>
        <div className="flex justify-center gap-2 pb-3">
          <span className="h-2 w-8 rounded-full bg-teal-500" />
          <span className="h-2 w-8 rounded-full bg-slate-300" />
        </div>
        <div className="flex justify-center pb-3">
          <div className="rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-400 p-4 text-white shadow-md">
            <Sparkles size={24} />
          </div>
        </div>
        <h1 className="text-center text-[42px] leading-[1.05] font-extrabold tracking-[-0.02em] text-slate-800">Welcome to Seen</h1>
        <p className="pb-4 text-center text-[22px] leading-tight text-slate-500">Tell us a bit about yourself to start connecting.</p>

        <InputRow icon={Globe} rightIcon={<ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />}>
          <select name="country" value={form.country} onChange={onChange}
            className="w-full appearance-none rounded-2xl border border-slate-300 bg-slate-50 py-3.5 pr-10 pl-11 text-base text-slate-500">
            <option value="">Select Country</option>
            {COUNTRY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </InputRow>

        <InputRow icon={User}>
          <input name="fullName" value={form.fullName} onChange={onChange} placeholder="Full Name"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pr-3 pl-11 text-base text-slate-700 placeholder:text-slate-400" />
        </InputRow>

        <InputRow icon={Mail}>
          <input type="email" name="email" value={form.email} onChange={onChange} placeholder="Email Address"
            readOnly={Boolean(initialEmail)}
            className={`w-full rounded-2xl border border-slate-200 py-3.5 pr-3 pl-11 text-base text-slate-700 placeholder:text-slate-400 ${initialEmail ? "bg-slate-100" : "bg-slate-50"}`} />
        </InputRow>

        {errorMessage && <p className="px-1 text-sm text-rose-600">{errorMessage}</p>}

        <div className="rounded-2xl border border-slate-300 bg-slate-100/80 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.08em] text-slate-500 uppercase">
            <Calendar size={13} /><span>Date of Birth</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { name: "dobMonth", placeholder: "Month", options: MONTHS },
              { name: "dobDay",   placeholder: "Day",   options: DAYS },
              { name: "dobYear",  placeholder: "Year",  options: YEARS },
            ].map(({ name, placeholder, options }) => (
              <div key={name} className="relative">
                <select name={name} value={form[name]} onChange={onChange}
                  className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-2.5 pr-8 pl-3 text-sm text-slate-700">
                  <option value="">{placeholder}</option>
                  {options.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              </div>
            ))}
          </div>
        </div>

        <button type="submit" disabled={!valid}
          className={`mt-2 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-xl font-semibold text-white transition-colors ${valid ? "bg-teal-600 hover:bg-teal-700" : "bg-slate-400"} disabled:cursor-not-allowed`}>
          Continue <ArrowRight size={18} />
        </button>
      </form>
    </div>
  );
}

function MysteryGiftModal({ open, reward, onClose }) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-slate-900/30 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-3xl border border-white/40 bg-white/95 p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-amber-100 text-amber-600">
          <Gift className="animate-bounce" size={30} />
        </div>
        <p className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase">Mystery Gift</p>
        <h2 className="mt-2 text-2xl font-extrabold text-slate-800">You unlocked a bonus!</h2>
        <p className="mt-3 text-lg font-bold text-emerald-600">+{reward} Sparks ✨</p>
        <p className="mt-2 text-sm text-slate-500">Your Spark balance has been boosted.</p>
        <button type="button" onClick={onClose}
          className="mt-6 w-full rounded-2xl bg-teal-600 px-4 py-3 font-semibold text-white transition hover:bg-teal-700">
          Awesome!
        </button>
      </div>
    </div>
  );
}

function GreetingPicker({ profile, streak, onSelect, onClose, onUpgrade, isSending = false, remainingToday }) {
  const isPremium = Boolean(profile?.isPremium);
  const categories = getGreetingsByCategory(isPremium);
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? "core");

  const activeGreetings = categories.find((c) => c.id === activeCategory)?.greetings ?? [];
  const allCategories = [
    { id: "core", label: "Greetings", emoji: "☀️", isPremium: false },
    { id: "warmth", label: "Warmth", emoji: "💛", isPremium: true },
    { id: "strength", label: "Strength", emoji: "💪", isPremium: true },
    { id: "celebrate", label: "Celebrate", emoji: "🎉", isPremium: true },
    { id: "calm", label: "Calm", emoji: "🌿", isPremium: true },
    { id: "cultural", label: "World", emoji: "🌍", isPremium: true },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase text-slate-400">Choose Message</span>
          {remainingToday !== undefined && (
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              remainingToday <= 2 ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
            }`}>
              {remainingToday} left today
            </span>
          )}
        </div>
        <button onClick={onClose} className="rounded-full bg-slate-100 flex items-center justify-center" style={{ minWidth: 44, minHeight: 44 }}>
          <ChevronDown size={16} className="text-slate-500" />
        </button>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {allCategories.map((cat) => {
          const locked = cat.isPremium && !isPremium;
          return (
            <button key={cat.id}
              onClick={() => locked ? onUpgrade() : setActiveCategory(cat.id)}
              className={`flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                activeCategory === cat.id && !locked
                  ? "border-teal-400 bg-teal-50 text-teal-700"
                  : locked
                  ? "border-amber-200 bg-amber-50 text-amber-600"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}>
              <span style={{ fontSize: "11px" }}>{cat.emoji}</span>
              {cat.label}
              {locked && <span className="text-[9px]">✨</span>}
            </button>
          );
        })}
      </div>
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {activeGreetings.map((greeting) => (
          <button key={greeting.id} onClick={() => !isSending && onSelect(greeting)}
            disabled={isSending}
            className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
              isSending ? "border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed" : "border-slate-200 bg-white text-slate-800 hover:border-teal-400 hover:bg-teal-50"
            }`}>
            <span>{greeting.text}</span>
            <span className="ml-2 text-xs text-teal-600">
              +{computeSparkReward(greeting.sparkReward, streak)} sparks
              {streak >= 3 && <span className="ml-1 text-orange-500">🔥</span>}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SparkRing({ value, max, percent }) {
  const size = 44, stroke = 3.5, r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = circ * (percent / 100);
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="url(#sparkGrad)" strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ - filled}
          style={{ transition: "stroke-dashoffset 0.7s ease" }} />
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#2dd4bf" />
            <stop offset="100%" stopColor="#34d399" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span style={{ fontSize: "11px", fontWeight: 700, color: "#0f766e", lineHeight: 1 }}>✨</span>
      </div>
    </div>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [profileLoadError, setProfileLoadError] = useState("");
  const [messages, setMessages] = useState([]);
  const [isChatLive, setIsChatLive] = useState(false);
  const [chatError, setChatError] = useState("");
  const [lastLiveAt, setLastLiveAt] = useState(null);
  const [chatRetryCount, setChatRetryCount] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [headerOpen, setHeaderOpen] = useState(false);
  // ── Tap-to-reveal: which message group's action bar is open ──
  const [activeMessageId, setActiveMessageId] = useState(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState("entry");
  const [pendingProfileData, setPendingProfileData] = useState(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [isEmailActionLoading, setIsEmailActionLoading] = useState(false);
  const [emailLinkMessage, setEmailLinkMessage] = useState("");
  const [authError, setAuthError] = useState("");
  const [onboardingError, setOnboardingError] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [unauthScreen, setUnauthScreen] = useState("welcome");
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [mysteryReward, setMysteryReward] = useState(0);
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [newMessageIds, setNewMessageIds] = useState(new Set());
  const [seenCountries, setSeenCountries] = useState(new Set());
  const prevMessagesRef = useRef([]);

  const endRef = useRef(null);
  const isRealSignedInUser = Boolean(currentUser && !currentUser.isAnonymous);
  const userProfileRef = (uid) => doc(db, "users", uid);
  const publicMessagesRef = collection(db, "publicMessages");

  const { streak, freezesAvailable, recordGreetingDay, buyFreeze, useFreeze, sellFreeze } =
    useStreak(db, currentUser?.uid, profile);

  const anim = useAnimations();
  const { burst: reactionBurst, trigger: triggerReactionBurst } = useReactionBurst();

  useEffect(() => {
    let unsubscribeProfile = null;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeProfile) { unsubscribeProfile(); unsubscribeProfile = null; }
      setCurrentUser(user); setIsAuthLoading(false); setAuthError(""); setEmailLinkMessage("");
      if (!user || user.isAnonymous) {
        setProfile(null); setHasCompletedOnboarding(false); setOnboardingStep("entry");
        setUnauthScreen("welcome"); setOnboardingError(""); setIsProfileLoading(false); return;
      }
      setIsProfileLoading(true);
      unsubscribeProfile = onSnapshot(userProfileRef(user.uid),
        (snap) => {
          const nextProfile = snap.exists() ? snap.data() : null;
          setProfile(nextProfile);
          const done = Boolean(nextProfile?.onboardingCompletedAt) || Boolean(nextProfile?.fullName && nextProfile?.country && nextProfile?.dob);
          setHasCompletedOnboarding(done); setOnboardingStep(done ? "done" : "details");
          setProfileLoadError(""); setIsProfileLoading(false);
        },
        (error) => {
          setProfile(null); setHasCompletedOnboarding(false); setOnboardingStep("details");
          setProfileLoadError(error?.code || "unknown"); setIsProfileLoading(false);
        }
      );
    });
    return () => { if (unsubscribeProfile) unsubscribeProfile(); unsubscribeAuth(); };
  }, []);

  useEffect(() => {
    if (isRealSignedInUser && hasCompletedOnboarding) scheduleGreetingWindowNotification(profile);
  }, [isRealSignedInUser, hasCompletedOnboarding]);

  useEffect(() => {
    const complete = async () => {
      if (!isSignInWithEmailLink(auth, window.location.href)) return;
      setIsAuthLoading(true); setAuthError("");
      try {
        const stored = window.localStorage.getItem("seenEmailForSignIn");
        if (!stored) { setAuthError("This sign-in link was opened on a different device."); return; }
        await signInWithEmailLink(auth, stored, window.location.href);
        window.localStorage.removeItem("seenEmailForSignIn");
        setEmailLinkMessage("");
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (error) {
        if (error?.code === "auth/invalid-action-code") setAuthError("This sign-in link is invalid.");
        else if (error?.code === "auth/expired-action-code") setAuthError("This sign-in link has expired.");
        else setAuthError("Unable to complete sign-in from the email link.");
      } finally { setIsAuthLoading(false); }
    };
    complete();
  }, []);

  // ── Click-away: dismiss action bar when tapping outside ──
  useEffect(() => {
    const h = () => setActiveMessageId(null);
    document.addEventListener("click", h);
    return () => document.removeEventListener("click", h);
  }, []);

  const sendEmailSignInLink = async (email) => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) return { error: "Please enter your email address." };
    setIsEmailActionLoading(true); setEmailLinkMessage(""); setAuthError("");
    try {
      await sendSignInLinkToEmail(auth, normalizedEmail, { url: `${window.location.origin}/`, handleCodeInApp: true });
      window.localStorage.setItem("seenEmailForSignIn", normalizedEmail);
      setEmailLinkMessage(`We sent a sign-in link to ${normalizedEmail}. Check your inbox.`);
      return { ok: true };
    } catch (error) {
      if (error?.code === "auth/invalid-email") return { error: "That email address is invalid." };
      if (error?.code === "auth/operation-not-allowed") return { error: "Email link sign-in is not enabled." };
      return { error: "Unable to send a sign-in link right now." };
    } finally { setIsEmailActionLoading(false); }
  };

  const signInWithPassword = async (email, password) => {
    setIsEmailActionLoading(true); setAuthError("");
    try {
      await signInWithEmailAndPassword(auth, normalizeEmail(email), password);
      return { ok: true };
    } catch (error) {
      if (error?.code === "auth/invalid-credential") return { error: "Incorrect email or password." };
      if (error?.code === "auth/user-disabled") return { error: "This account has been disabled." };
      return { error: "Unable to sign in right now." };
    } finally { setIsEmailActionLoading(false); }
  };

  const signUpWithPassword = async ({ email, password, fullName }) => {
    setIsEmailActionLoading(true); setAuthError("");
    try {
      const credential = await createUserWithEmailAndPassword(auth, normalizeEmail(email), password);
      if (fullName) await updateAuthProfile(credential.user, { displayName: fullName });
      setPendingProfileData((prev) => ({ ...prev, fullName, email: normalizeEmail(email) }));
      return { ok: true };
    } catch (error) {
      if (error?.code === "auth/email-already-in-use") return { error: "That email address is already in use." };
      if (error?.code === "auth/weak-password") return { error: "Password must be at least 6 characters." };
      if (error?.code === "auth/invalid-email") return { error: "That email address is invalid." };
      return { error: "Unable to create your account right now." };
    } finally { setIsEmailActionLoading(false); }
  };

  const forgotPassword = async (email) => {
    setIsEmailActionLoading(true); setAuthError("");
    try {
      await sendPasswordResetEmail(auth, normalizeEmail(email));
      return { ok: true };
    } catch (error) {
      if (error?.code === "auth/user-not-found") return { error: "No account exists for that email address." };
      if (error?.code === "auth/invalid-email") return { error: "That email address is invalid." };
      return { error: "Unable to send password reset email right now." };
    } finally { setIsEmailActionLoading(false); }
  };

  const signInWithGoogle = async () => {
    setIsGoogleSigningIn(true); setAuthError(""); setEmailLinkMessage("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      if (error?.code === "auth/popup-blocked" || error?.code === "auth/cancelled-popup-request") {
        await signInWithRedirect(auth, googleProvider); return;
      }
      if (error?.code === "auth/unauthorized-domain") setAuthError(`This domain is not in Firebase Authorized domains.`);
      else if (error?.code === "auth/operation-not-allowed") setAuthError("Google sign-in is not enabled.");
      else setAuthError("Google sign-in failed. Please try again.");
    } finally { setIsGoogleSigningIn(false); }
  };

  useEffect(() => {
    if (!currentUser || currentUser.isAnonymous) return;
    let retryTimer = null;
    const q = query(publicMessagesRef, orderBy("timestamp", "asc"), limit(100));
    const unsubscribe = onSnapshot(q,
      (snap) => {
        const live = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const finalMessages = live.length ? live : [{ id: "welcome", sender: "Seen", text: "Welcome! Chat is live and ready ✨", uid: "system", timestamp: Date.now() }];
        const prevIds = new Set(prevMessagesRef.current.map((m) => m.id));
        const brandNewIds = new Set(finalMessages.filter((m) => !prevIds.has(m.id)).map((m) => m.id));
        if (brandNewIds.size > 0) {
          setNewMessageIds((prev) => new Set([...prev, ...brandNewIds]));
          setTimeout(() => setNewMessageIds((prev) => {
            const next = new Set(prev);
            brandNewIds.forEach((id) => next.delete(id));
            return next;
          }), 800);
        }
        finalMessages.forEach((m) => {
          if (m.country && !seenCountries.has(m.id)) {
            setSeenCountries((prev) => new Set([...prev, m.id]));
          }
        });
        prevMessagesRef.current = finalMessages;
        setMessages(finalMessages);
        setIsChatLive(true); setChatError(""); setLastLiveAt(new Date());
      },
      (error) => {
        setIsChatLive(false); setChatError(error?.code || "unknown");
        retryTimer = setTimeout(() => setChatRetryCount((c) => c + 1), 3000);
      }
    );
    return () => { if (retryTimer) clearTimeout(retryTimer); unsubscribe(); };
  }, [currentUser, chatRetryCount]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const sparkBalance = Number(profile?.sparkBalance ?? 0);
  const currentLevel = useMemo(() => LEVEL_THRESHOLDS.reduce((l, t) => sparkBalance >= t.min ? t : l, LEVEL_THRESHOLDS[0]), [sparkBalance]);
  const nextLevel = useMemo(() => LEVEL_THRESHOLDS.find((t) => t.min > sparkBalance) || null, [sparkBalance]);
  const progressPercent = useMemo(() => {
    if (!nextLevel) return 100;
    const span = nextLevel.min - currentLevel.min;
    return span <= 0 ? 100 : Math.max(0, Math.min(100, Math.round(((sparkBalance - currentLevel.min) / span) * 100)));
  }, [currentLevel.min, nextLevel, sparkBalance]);

  const { displayed: displayedSparks, flashing: sparksFlashing } = useSparkCounter(sparkBalance);
  const animatedProgress = useProgressBarFill(progressPercent);

  const todayMessageCount = useMemo(() =>
    messages.filter((m) => m.uid === currentUser?.uid && m.timestamp > startOfToday()).length,
    [messages, currentUser]
  );

  const handleSignOut = async () => {
    if (isSigningOut) return;
    try { setIsSigningOut(true); await signOut(auth); setPickerOpen(false); }
    catch (error) { console.error(error); }
    finally { setIsSigningOut(false); }
  };

  const completeOnboarding = async (data) => {
    setOnboardingError(""); setIsSavingProfile(true);
    try {
      const user = auth.currentUser;
      if (!user || user.isAnonymous) { setOnboardingError("Please sign in before continuing."); return; }
      const normalizedEmail = normalizeEmail(user.email || data.email);
      if (!normalizedEmail) { setOnboardingError("We could not verify your account email."); return; }
      let profilePhotoUrl = profile?.profilePhotoUrl || "";
      if (data.profilePhoto instanceof File) {
        const ext = data.profilePhoto.name.split(".").pop()?.toLowerCase() || "jpg";
        const photoRef = ref(storage, `profilePhotos/${user.uid}/avatar.${ext}`);
        await uploadBytes(photoRef, data.profilePhoto, { contentType: data.profilePhoto.type });
        profilePhotoUrl = await getDownloadURL(photoRef);
      }
      await setDoc(userProfileRef(user.uid), {
        fullName: data.fullName, email: normalizedEmail, country: data.country, dob: data.dob,
        profilePhotoUrl, ownerUid: user.uid, sparkBalance: Number(profile?.sparkBalance ?? 0),
        updatedAt: serverTimestamp(), onboardingCompletedAt: serverTimestamp(),
      }, { merge: true });
      setPendingProfileData(null); setHasCompletedOnboarding(true); setOnboardingStep("done");
    } catch (error) {
      if (error?.code === "storage/unauthorized") { setOnboardingError("Storage rules are blocking photo upload."); return; }
      if (error?.code === "permission-denied") { setOnboardingError("Firestore rules are blocking profile save."); return; }
      if (error?.code === "unavailable") { setOnboardingError("Firebase is temporarily unavailable."); return; }
      setOnboardingError(error?.code ? `Unable to save your profile (${error.code}).` : "Unable to save your profile right now.");
    } finally { setIsSavingProfile(false); }
  };

  const DAILY_GREETING_LIMIT = 10;
  const haptic = (pattern = [8]) => { try { navigator.vibrate?.(pattern); } catch(_) {} };

  const handleSendMessage = async (greeting) => {
    if (!currentUser || !profile || isSending) return;
    if (todayMessageCount >= DAILY_GREETING_LIMIT) return;
    setIsSending(true);
    try {
      await addDoc(publicMessagesRef, {
        uid: currentUser.uid,
        sender: profile.fullName,
        text: greeting.text,
        timestamp: nowMs(),
        moodTag: profile?.moodTag ?? null,
      });
      const reward = computeSparkReward(greeting.sparkReward, streak);
      const refDoc = userProfileRef(currentUser.uid);
      let newStreak = streak;
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(refDoc);
        const profileData = snap.exists() ? snap.data() : {};
        transaction.set(refDoc, {
          sparkBalance: Number(profileData?.sparkBalance ?? 0) + reward,
          lastGreetingAt: nowMs(),
          ...(greeting.isMystery ? { lastMysteryGiftAt: nowMs() } : {}),
        }, { merge: true });
      });
      await recordGreetingDay();
      newStreak = streak + 1;
      anim.triggerSparkBurst(85, 92);
      haptic([10, 30, 10]);
      if ([3, 7, 14, 30].includes(newStreak)) {
        setTimeout(() => anim.triggerStreakConfetti(), 300);
      }
      if (greeting.isMystery) {
        setMysteryReward(reward);
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setShowGiftModal(true);
      }
      setPickerOpen(false);
    } finally {
      setIsSending(false);
    }
  };

  if (isAuthLoading || (isRealSignedInUser && isProfileLoading)) {
    return <div className="grid h-screen place-items-center bg-slate-50"><Loader2 className="animate-spin text-teal-600" /></div>;
  }

  if (!isRealSignedInUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-2 sm:p-6">
        <div className="relative flex h-[100dvh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-white/80 bg-white/95 shadow-2xl backdrop-blur sm:h-[90vh]">
          {unauthScreen === "welcome"
            ? <WelcomeStep onStartJourney={() => setUnauthScreen("signin")} />
            : <SignInStep onEmailLinkSignIn={sendEmailSignInLink} onPasswordSignIn={signInWithPassword}
                onPasswordSignUp={signUpWithPassword} onForgotPassword={forgotPassword} onGoogleSignIn={signInWithGoogle}
                loading={isEmailActionLoading} googleLoading={isGoogleSigningIn} googleError={authError}
                emailLinkMessage={emailLinkMessage} authError={authError} />}
        </div>
      </div>
    );
  }

  const firstName = profile?.fullName?.trim()?.split(" ")?.[0] || currentUser?.displayName?.split(" ")?.[0] || "there";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-2 sm:p-6">
      {/* Keyframe for action bar spring-in */}
      <style>{`
        @keyframes seenActionBarIn {
          0%   { opacity: 0; transform: translateY(-6px) scale(0.95); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <AnimationLayer controller={anim} />
      <ReactionBurstLayer burst={reactionBurst} />

      {showMap && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/20 p-2 sm:p-6">
          <MapTransitionWrapper visible={showMap}>
            <div className="relative h-[100dvh] w-full max-w-md overflow-hidden rounded-3xl border border-white/[0.07] shadow-2xl sm:h-[90vh]">
              <WorldMap db={db} currentUser={currentUser} profile={profile} onClose={() => setShowMap(false)} />
            </div>
          </MapTransitionWrapper>
        </div>
      )}

      <div data-dark-shell className="relative flex h-[100dvh] w-full max-w-md flex-col overflow-hidden rounded-3xl sm:h-[90vh]">

        <MysteryGiftModal open={showGiftModal} reward={mysteryReward} onClose={() => setShowGiftModal(false)} />

        {showProfileCard && (
          <ProfileCard profile={profile} streak={streak} sparkBalance={sparkBalance} onClose={() => setShowProfileCard(false)} />
        )}

        {showUpgrade && <PremiumUpgradePrompt onClose={() => setShowUpgrade(false)} />}

        {!hasCompletedOnboarding || !profile ? (
          <>
            {profileLoadError && (
              <p className="mx-4 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Couldn't read your profile ({profileLoadError}).
              </p>
            )}
            {onboardingStep === "entry" ? (
              <SignInStep onEmailLinkSignIn={sendEmailSignInLink} onPasswordSignIn={signInWithPassword}
                onPasswordSignUp={signUpWithPassword} onForgotPassword={forgotPassword} onGoogleSignIn={signInWithGoogle}
                loading={isEmailActionLoading} googleLoading={isGoogleSigningIn} googleError={authError}
                emailLinkMessage={emailLinkMessage} authError={authError} />
            ) : onboardingStep === "details" ? (
              <Onboarding onContinue={async (data) => { setOnboardingError(""); setPendingProfileData(data); setOnboardingStep("photo"); }}
                loading={isSavingProfile} initialData={pendingProfileData}
                initialEmail={currentUser?.email || ""} errorMessage={onboardingError} />
            ) : (
              <ProfilePhotoStep onBack={() => setOnboardingStep("details")}
                onComplete={(photoFile) => completeOnboarding({ ...pendingProfileData, profilePhoto: photoFile })}
                loading={isSavingProfile} initialPhoto={pendingProfileData?.profilePhotoUrl || ""} />
            )}
          </>
        ) : (
          <>
            {/* ── COLLAPSIBLE HEADER ── */}
            <header className="border-b border-slate-100 bg-white/90 backdrop-blur z-10 flex-shrink-0" style={{ paddingTop: "env(safe-area-inset-top)" }}>
              <div
                className="flex items-center justify-between px-4 py-2.5 cursor-pointer select-none"
                onClick={() => setHeaderOpen((v) => !v)}>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h1 className="text-sm font-bold text-slate-800 truncate">Hey {firstName}</h1>
                    {profile?.moodTag && (
                      <span className="text-base leading-none">
                        {{ grateful:"🙏", hopeful:"🌱", tired:"😴", happy:"😊", struggling:"🌧️", peaceful:"☁️", energised:"⚡", lonely:"🌙" }[profile.moodTag]}
                      </span>
                    )}
                    {streak > 0 && (
                      <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold border ${
                        streak >= 7 ? "bg-orange-50 border-orange-200 text-orange-700" : "bg-slate-50 border-slate-200 text-slate-600"
                      }`}>
                        {streak >= 7 ? "🔥" : "✨"}{streak}d
                      </span>
                    )}
                  </div>
                  <LiveGreeterCount db={db} currentUser={currentUser} compact />
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <span className={`text-slate-300 text-xs mr-1 transition-transform duration-200 ${headerOpen ? "rotate-180" : ""}`}>▾</span>
                  <div onClick={(e) => e.stopPropagation()}>
                    <NotificationBell streak={streak} db={db} currentUser={currentUser} />
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <MeatballMenu
                      onWorld={() => setShowMap(true)}
                      onShare={() => setShowProfileCard(true)}
                      onSignOut={handleSignOut}
                      isSigningOut={isSigningOut}
                      globePulse={anim.globePulse}
                      db={db}
                      currentUser={currentUser}
                      profile={profile}
                    />
                  </div>
                </div>
              </div>

              <div
                className="overflow-hidden transition-all duration-300 ease-in-out"
                style={{ maxHeight: headerOpen ? "480px" : "0px", opacity: headerOpen ? 1 : 0 }}>
                <div className="px-4 pb-3 space-y-2 border-t border-slate-100 pt-2">
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
                    <SparkRing value={displayedSparks} max={nextLevel?.min ?? sparkBalance} percent={animatedProgress} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800">{currentLevel.title}</p>
                      <p className="text-[11px] text-slate-500"
                        style={{ animation: sparksFlashing ? "seenSparkFlash 600ms ease-out" : "none" }}>
                        {nextLevel ? `${displayedSparks} / ${nextLevel.min} Sparks` : `${displayedSparks} Sparks · Max level!`}
                      </p>
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-gradient-to-r from-teal-400 to-emerald-500"
                          style={{ width: `${animatedProgress}%`, transition: "width 0.85s cubic-bezier(0.34,1.2,0.64,1)", boxShadow: animatedProgress > 5 ? "0 0 6px rgba(45,212,191,0.7)" : "none" }} />
                      </div>
                    </div>
                    <StreakFreezeButton freezes={freezesAvailable} sparkBalance={sparkBalance} onBuy={buyFreeze} onSell={sellFreeze} />
                  </div>
                  <KindnessPledge db={db} uid={currentUser.uid} todayMessageCount={todayMessageCount} />
                  <MoodSelector db={db} uid={currentUser.uid} currentMood={profile?.moodTag} />
                  <div className="space-y-1">
                    <NotificationPermissionBanner />
                    {!isChatLive && chatError && (
                      <p className="rounded-xl border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                        Chat offline ({chatError}).
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </header>

            <main className="flex-1 overflow-y-auto bg-slate-50/60 p-4">
              {(() => {
                const grouped = [];
                messages.forEach((m) => {
                  const last = grouped[grouped.length - 1];
                  if (last && last.uid === m.uid) { last.items.push(m); }
                  else { grouped.push({ uid: m.uid, sender: m.sender, moodTag: m.moodTag, items: [m] }); }
                });
                return grouped.map((group) => {
                  const mine = group.uid === currentUser.uid;
                  const isMulti = group.items.length > 1;
                  const firstId = group.items[0].id;
                  const isNewGroup = newMessageIds.has(firstId);
                  return (
                    <MessageSlideIn key={firstId} mine={mine} isNew={isNewGroup}>
                      <div className={`mb-4 flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div className="max-w-[82%] group">
                          <div className={`flex items-center gap-1.5 px-1 mb-1 text-[10px] font-semibold text-slate-400 ${mine ? "justify-end" : ""}`}>
                            {!mine && <span>{group.sender}</span>}
                            {!mine && group.items[0].country && (
                              <CountryReveal country={group.items[0].country} isNew={isNewGroup} />
                            )}
                            {group.moodTag && <MoodPill mood={group.moodTag} tiny />}
                            {mine && <span>{group.sender}</span>}
                          </div>
                          <div className={`relative ${isMulti && !mine ? "pl-3" : isMulti && mine ? "pr-3" : ""}`}>
                            {isMulti && (
                              <div className={`absolute top-2 bottom-2 w-0.5 rounded-full ${mine ? "right-0 bg-teal-300" : "left-0 bg-slate-300"}`} />
                            )}
                            <div className="space-y-0.5">
                              {group.items.map((m, idx) => {
                                const isFirst = idx === 0;
                                const isLast = idx === group.items.length - 1;
                                const isMystery = Boolean(m.isMystery);
                                const topRadius = isFirst ? "rounded-t-2xl" : "rounded-t-lg";
                                const botRadius = isLast ? "rounded-b-2xl" : "rounded-b-lg";
                                const tailClass = isLast ? (mine ? "rounded-br-none" : "rounded-bl-none") : "";
                                const isActive = activeMessageId === m.id;
                                return (
                                  <div key={m.id} className="relative pb-3">
                                    {/* Bubble — tap to toggle action bar */}
                                    <div
                                      className="relative"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveMessageId(isActive ? null : m.id);
                                      }}>
                                      <div
                                        className={`border px-3 py-2.5 text-sm font-semibold ${topRadius} ${botRadius} ${tailClass} ${
                                          mine
                                            ? "bg-teal-600 text-white border-teal-600"
                                            : isMystery
                                            ? "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 text-amber-900"
                                            : "bg-white border-slate-200 text-slate-800"
                                        }`}
                                        style={isMystery && !mine ? { boxShadow: "0 0 0 1px rgba(251,146,60,0.2), 0 2px 8px rgba(251,146,60,0.08)" } : {}}>
                                        {isMystery && !mine && <span className="mr-1.5">🎁</span>}
                                        {m.text}
                                      </div>
                                      <ReactionSideBadges db={db} messageId={m.id} currentUser={currentUser} mine={mine} onReact={triggerReactionBurst} />
                                    </div>

                                    {/* ── Tap-to-reveal action bar ── */}
                                    {isLast && isActive && (
                                      <div
                                        className={`flex items-center gap-1.5 mt-1 ${mine ? "justify-end" : "justify-start"}`}
                                        style={{ animation: "seenActionBarIn 180ms cubic-bezier(0.34,1.3,0.64,1) both" }}
                                        onClick={(e) => e.stopPropagation()}>
                                        {!mine && (
                                          <WaveBackButton
                                            db={db} messageId={m.id} senderUid={m.uid} currentUser={currentUser}
                                            onWave={() => { triggerReactionBurst("👋"); anim.triggerWaveRipple(15, 70); haptic([6]); }}
                                          />
                                        )}
                                        {!mine && (
                                          <SparkGiftButton
                                            db={db} senderUid={m.uid} currentUser={currentUser} profile={profile}
                                            onGift={(emoji) => { triggerReactionBurst(emoji); haptic([6, 20, 6]); }}
                                          />
                                        )}
                                        <MessageReactions
                                          db={db} messageId={m.id} currentUser={currentUser}
                                          onReact={(emoji) => { triggerReactionBurst(emoji); haptic([5]); }}
                                        />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </MessageSlideIn>
                  );
                });
              })()}
              <SendingIndicator visible={isSending} />
              <div ref={endRef} />
            </main>

            {/* FAB-style footer */}
            <footer className="border-t border-slate-100 bg-white px-4 pt-2.5" style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}>
              {todayMessageCount >= DAILY_GREETING_LIMIT ? (
                <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2.5">
                  <span className="text-lg">🌙</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-amber-800">You've spread 10 greetings today!</p>
                    <p className="text-[11px] text-amber-600">Your daily kindness quota resets at midnight. See you tomorrow ✨</p>
                  </div>
                </div>
              ) : !pickerOpen ? (
                <div className="flex items-center gap-2.5">
                  <div className="flex-1 rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-400 cursor-pointer"
                    onClick={() => setPickerOpen(true)}>
                    <span>Send a kind greeting…</span>
                    {todayMessageCount > 0 && (
                      <span className="ml-2 text-[10px] font-semibold text-slate-400">
                        {DAILY_GREETING_LIMIT - todayMessageCount} left today
                      </span>
                    )}
                  </div>
                  <button onClick={() => setPickerOpen(true)} disabled={isSending}
                    className={`seen-send-btn h-12 w-12 flex-shrink-0 rounded-full flex items-center justify-center transition-colors ${
                      isSending
                        ? "bg-teal-400 shadow-none scale-90 cursor-not-allowed"
                        : "bg-teal-500 shadow-md shadow-teal-200 hover:bg-teal-600"
                    }`}>
                    {isSending
                      ? <Loader2 size={15} className="text-white animate-spin" />
                      : <Send size={15} className="text-white" />}
                  </button>
                </div>
              ) : null}
            </footer>

            {/* ── Bottom sheet greeting picker ── */}
            {pickerOpen && (
              <div className="absolute inset-0 z-40 flex flex-col justify-end" style={{ touchAction: "none" }}>
                <div
                  className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
                  style={{ animation: "seenBackdropIn 200ms ease-out both" }}
                  onClick={() => setPickerOpen(false)}
                />
                <div
                  className="relative z-10 rounded-t-3xl bg-white px-4 pt-3 pb-2 shadow-2xl"
                  style={{ animation: "seenSheetRise 400ms cubic-bezier(0.34,1.56,0.64,1) both", paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}>
                  <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
                  <GreetingPicker
                    profile={profile}
                    streak={streak}
                    onSelect={handleSendMessage}
                    onClose={() => setPickerOpen(false)}
                    onUpgrade={() => { setPickerOpen(false); setShowUpgrade(true); }}
                    isSending={isSending}
                    remainingToday={DAILY_GREETING_LIMIT - todayMessageCount}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
