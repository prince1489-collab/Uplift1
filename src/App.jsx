// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight, ArrowLeft, Bell, Calendar, ChevronDown, CreditCard, Globe, Heart,
  Loader2, Mail, LogOut, Moon, Send, Sparkles, Gift, Sun, User, UserPlus, Users, Share2, Shield, X,
} from "lucide-react";
import WorldMap, { COUNTRY_COORDS } from "./WorldMap";
import { AnimationLayer, useAnimations, useSparkCounter, useProgressBarFill,
  MessageSlideIn, SendingIndicator, GreetingSheetWrapper, MapTransitionWrapper,
  CountryReveal, LiveCountTick, StreakBadgeWithPulse,
  ReactionBurstLayer, useReactionBurst, FLAG_MAP } from "./MicroAnimations";

import ProfilePhotoStep from "./ProfilePhotoStep";
import SignInStep from "./SignInStep";
import WelcomeStep from "./WelcomeStep";
import IntroStep from "./IntroStep";

import { CirclesPanel, useCircles, CircleInviteBanner } from "./Circles";
import { StickerDisplay } from "./StickerReactions";
import GoodNews from "./GoodNews";
import LifeHacks from "./LifeHacks";
import Support from "./Support";
import MyImpact from "./MyImpact";

import {
  useStreak, computeSparkReward,
  StreakBadge, StreakFreezeButton,
  SparkGiftButton,
  LiveGreeterCount, MessageReactions,
  ProfileCard,
  WaveBackButton, ReactionSideBadges,
  GiftOverlay,
  MoodSelector, MoodPill,
  PremiumUpgradePrompt,
  scheduleGreetingWindowNotification,
  NotificationPermissionBanner,
  QuickReactBar,
} from "./UpliftRetentionFeatures";

import {
  PrivateChatInbox,
  PrivateChatWindow,
  usePendingChatCount,
  usePrivateUnreadCount,
} from "./PrivateChat";

import { getGreetingsByCategory, getAccessibleGreetings, getCurrentMonthTheme, MYSTERY_MESSAGES } from "./greetings";

import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider, getAuth, onAuthStateChanged, signOut,
  signInWithPopup, signInWithRedirect, sendSignInLinkToEmail,
  isSignInWithEmailLink, signInWithEmailLink,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, updateProfile as updateAuthProfile,
} from "firebase/auth";

import {
  addDoc, arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, getFirestore,
  limit, limitToLast, onSnapshot, orderBy, query,
  runTransaction, serverTimestamp, setDoc, updateDoc, where,
} from "firebase/firestore";

import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

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
const messaging = (() => { try { return getMessaging(app); } catch { return null; } })();

// localStorage that never throws (private mode / disabled storage / SSR).
const safeLocalGet = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
const safeLocalSet = (key, value) => { try { localStorage.setItem(key, value); } catch { /* ignore */ } };

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
  { min: 0,         title: "Still Loading…" },
  { min: 50,        title: "Vibe Check: Passed" },
  { min: 150,       title: "It's Giving Kind" },
  { min: 300,       title: "Chronically Wholesome" },
  { min: 600,       title: "Main Character Energy" },
  { min: 1_500,     title: "Understood the Assignment" },
  { min: 4_000,     title: "Serotonin Dealer" },
  { min: 10_000,    title: "Ate and Left No Crumbs" },
  { min: 25_000,    title: "Lowkey Iconic" },
  { min: 60_000,    title: "Living Rent Free in Hearts" },
  { min: 150_000,   title: "Real One, No Debate" },
  { min: 350_000,   title: "In Your Kindness Era" },
  { min: 750_000,   title: "Highkey Goated" },
  { min: 1_500_000, title: "It's Giving Legend" },
  { min: 3_000_000, title: "The Algorithm Fears You" },
  { min: 5_000_000, title: "No Cap, Just Impact" },
  { min: 7_500_000, title: "Ate Every Assignment" },
  { min: 10_000_000,title: "Chronically GOATED" },
];

const nowMs = () => Date.now();
const normalizeEmail = (email = "") => email.trim().toLowerCase();

function fmtTime(ts) {
  if (!ts) return "";
  const ms = typeof ts === "number" ? ts : ts?.toMillis ? ts.toMillis() : Number(ts);
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

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

const MOOD_TAGLINES = {
  grateful:   "feeling grateful",
  hopeful:    "feeling hopeful",
  tired:      "a little tired",
  happy:      "feeling happy",
  struggling: "going through it",
  peaceful:   "at peace",
  energised:  "full of energy",
  lonely:     "feeling a bit lonely",
};

function getMoodBubbleStyle(moodTag, isMine) {
  if (!moodTag) return null;
  const MINE = {
    grateful:   { background: "linear-gradient(135deg,#87a87a,#6b8f6b)", borderColor: "#6b8f6b", boxShadow: "0 4px 14px rgba(107,143,107,0.35)" },
    hopeful:    { background: "linear-gradient(135deg,#fcd34d,#eab308)", borderColor: "#eab308", boxShadow: "0 4px 14px rgba(234,179,8,0.35)"    },
    tired:      { background: "linear-gradient(135deg,#94a3b8,#64748b)", borderColor: "#64748b", boxShadow: "0 4px 14px rgba(100,116,139,0.35)"  },
    happy:      { background: "linear-gradient(135deg,#fb923c,#f97316)", borderColor: "#f97316", boxShadow: "0 4px 14px rgba(249,115,22,0.35)"   },
    struggling: { background: "linear-gradient(135deg,#c9899a,#a86778)", borderColor: "#a86778", boxShadow: "0 4px 14px rgba(168,103,120,0.35)"  },
    peaceful:   { background: "linear-gradient(135deg,#7dd3fc,#38bdf8)", borderColor: "#38bdf8", boxShadow: "0 4px 14px rgba(56,189,248,0.28)"   },
    energised:  { background: "linear-gradient(135deg,#f87171,#ef4444)", borderColor: "#ef4444", boxShadow: "0 4px 14px rgba(239,68,68,0.35)"    },
    lonely:     { background: "linear-gradient(135deg,#7c3aed,#4c1d95)", borderColor: "#4c1d95", boxShadow: "0 4px 14px rgba(76,29,149,0.35)"    },
  };
  const THEIRS = {
    grateful:   { backgroundColor: "#f0f4ef", borderColor: "#b5cdb5", color: "#3d6e3d" },
    hopeful:    { backgroundColor: "#fefce8", borderColor: "#fde047", color: "#713f12" },
    tired:      { backgroundColor: "#f1f5f9", borderColor: "#cbd5e1", color: "#334155" },
    happy:      { backgroundColor: "#fff7ed", borderColor: "#fed7aa", color: "#9a3412" },
    struggling: { backgroundColor: "#fdf2f5", borderColor: "#f0c4cf", color: "#8b3547" },
    peaceful:   { backgroundColor: "#f0f9ff", borderColor: "#bae6fd", color: "#0c4a6e" },
    energised:  { backgroundColor: "#fef2f2", borderColor: "#fecaca", color: "#991b1b" },
    lonely:     { backgroundColor: "#f5f3ff", borderColor: "#ddd6fe", color: "#4c1d95" },
  };
  return isMine ? (MINE[moodTag] || null) : (THEIRS[moodTag] || null);
}

function MeatballMenu({ onWorld, onShare, onUpgrade, onManageSubscription, onSupport, onSignOut, isSigningOut, globePulse, db, currentUser, profile, isPremium, streak, sparkBalance, onImpact }) {
  const [open, setOpen] = useState(false);
  const [showCircles, setShowCircles] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  const inviteLink = `https://seenapp.app/?ref=${currentUser?.uid || ""}`;
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const handleCopyInvite = async () => {
    try { await navigator.clipboard.writeText(inviteLink); } catch (_) {}
    setInviteCopied(true);
    setTimeout(() => setInviteCopied(false), 2500);
  };

  const handleShareInvite = async () => {
    try {
      await navigator.share({
        title: "Join me on Seen",
        text: "Someone out there needs to hear from you 💌 — join Seen, the kindness app. We both get +50 Sparks when you sign up!",
        url: inviteLink,
      });
    } catch (_) {}
  };

  const currentLevel = LEVEL_THRESHOLDS.reduce(
    (l, t) => sparkBalance >= t.min ? t : l,
    LEVEL_THRESHOLDS[0]
  );
  const firstName = profile?.fullName?.trim()?.split(" ")?.[0]
    || currentUser?.displayName?.split(" ")?.[0]
    || "You";

  const close = () => setOpen(false);

  const IconBox = ({ children, className = "bg-slate-100" }) => (
    <div className={`h-9 w-9 rounded-xl flex items-center justify-center flex-shrink-0 ${className}`}>
      {children}
    </div>
  );

  const Row = ({ onClick, icon, label, sub, danger = false }) => (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 px-3 py-2.5 rounded-2xl transition-colors ${danger ? "hover:bg-red-50" : "hover:bg-slate-50"}`}>
      {icon}
      <div className="flex-1 text-left min-w-0">
        <p className={`text-sm font-medium truncate ${danger ? "text-red-500" : "text-slate-700"}`}>{label}</p>
        {sub && <p className="text-[11px] text-slate-400 truncate">{sub}</p>}
      </div>
    </button>
  );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 active:scale-90 transition-all"
        aria-label="More options">
        <span className="text-lg leading-none tracking-widest">···</span>
      </button>

      {open && createPortal(
        <div data-portal className="fixed inset-0 z-[150] flex flex-col justify-end">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={(e) => {
              if (!e.target.closest?.("[data-portal] > div:last-child")) close();
            }}
          />

          {/* Sheet */}
          <div
            className="relative sheet-slide-up rounded-t-3xl bg-white shadow-2xl max-h-[90dvh] flex flex-col"
            onClick={e => e.stopPropagation()}>

            {/* Drag handle */}
            <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
              <div className="w-10 h-1 rounded-full bg-slate-200" />
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto overscroll-contain">

              {/* User header */}
              <div className="px-4 pt-1 pb-4 flex items-center gap-3">
                {profile?.profilePhotoUrl
                  ? <img src={profile.profilePhotoUrl} alt="" className="h-12 w-12 rounded-full object-cover flex-shrink-0 ring-2 ring-slate-100" />
                  : <div className="h-12 w-12 rounded-full bg-gradient-to-br from-teal-400 to-emerald-500 flex items-center justify-center text-lg font-bold text-white flex-shrink-0">
                      {firstName[0]?.toUpperCase()}
                    </div>
                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-800 truncate">{profile?.fullName ?? firstName}</p>
                  </div>
                  <p className="text-xs text-slate-400 truncate">{currentLevel.title}</p>
                </div>
                {streak > 0 && (
                  <div className="flex flex-col items-center gap-0.5 flex-shrink-0 ml-1">
                    <span className="text-xl leading-none">{streak >= 7 ? "🔥" : "✨"}</span>
                    <span className="text-[10px] font-bold text-slate-500">{streak}d</span>
                  </div>
                )}
              </div>

              <div className="mx-4 border-t border-slate-100" />

              {/* Main actions */}
              <div className="px-3 py-2 space-y-0.5">

                <Row
                  onClick={() => { onWorld(); close(); }}
                  icon={<IconBox><Globe size={16} className={globePulse ? "text-teal-500" : "text-slate-500"} /></IconBox>}
                  label="World Map"
                  sub="See who's spreading kindness"
                />
                <Row
                  onClick={() => { onImpact(); close(); }}
                  icon={<IconBox className="bg-teal-50"><span style={{ fontSize: "15px", lineHeight: 1 }}>🌍</span></IconBox>}
                  label="My Kindness Footprint"
                  sub="Your reach · countries · reactions"
                />
                <Row
                  onClick={() => { onShare(); close(); }}
                  icon={<IconBox><User size={16} className="text-slate-500" /></IconBox>}
                  label="My Profile"
                  sub={`${sparkBalance.toLocaleString()} sparks · ${currentLevel.title}`}
                />

                {/* Circles row — expands inline */}
                <button
                  onClick={() => setShowCircles(v => !v)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-slate-50 transition-colors">
                  <IconBox><Users size={16} className="text-slate-500" /></IconBox>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-slate-700">Circles</p>
                    <p className="text-[11px] text-slate-400">Your private kindness groups</p>
                  </div>
                  <ChevronDown
                    size={15}
                    className={`text-slate-400 flex-shrink-0 transition-transform duration-200 ${showCircles ? "rotate-180" : ""}`}
                  />
                </button>
                {showCircles && (
                  <div className="mx-1 rounded-2xl border border-slate-100 bg-slate-50 px-3 py-3">
                    <CirclesPanel db={db} currentUser={currentUser} isPremium={isPremium} />
                  </div>
                )}

              </div>

              {/* Invite a Friend */}
              <div className="mx-4 border-t border-slate-100 mt-1" />
              <div className="px-3 py-2 space-y-0.5">
                <button
                  onClick={() => setShowInvite(v => !v)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-slate-50 transition-colors">
                  <IconBox className="bg-emerald-50">
                    <UserPlus size={16} className="text-emerald-500" />
                  </IconBox>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-slate-700">Invite a Friend</p>
                    <p className="text-[11px] text-slate-400">You both earn +50 Sparks ✨</p>
                  </div>
                  <ChevronDown size={15} className={`text-slate-400 flex-shrink-0 transition-transform duration-200 ${showInvite ? "rotate-180" : ""}`} />
                </button>
                {showInvite && (
                  <div className="mx-1 rounded-2xl border border-emerald-100 bg-emerald-50 p-3 space-y-2">
                    <p className="text-[11px] font-semibold text-emerald-800">Your invite link:</p>
                    <div className="flex items-center rounded-xl border border-emerald-200 bg-white px-3 py-2">
                      <p className="flex-1 text-[10px] text-slate-500 truncate font-mono">{inviteLink}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={handleCopyInvite}
                        className={`flex-1 rounded-xl py-2 text-[11px] font-bold transition-all border ${
                          inviteCopied
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                        }`}>
                        {inviteCopied ? "Copied ✓" : "Copy link"}
                      </button>
                      {canShare && (
                        <button
                          onClick={handleShareInvite}
                          className="flex-1 rounded-xl py-2 text-[11px] font-bold bg-emerald-500 text-white border border-emerald-500 hover:bg-emerald-600 transition-colors flex items-center justify-center gap-1">
                          <Share2 size={11} /> Share
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-emerald-600 text-center">
                      Friend signs up → you both get +50 Sparks automatically
                    </p>
                  </div>
                )}
              </div>

              <div className="mx-4 border-t border-slate-100" />

              {/* Sign out */}
              <div className="px-3 py-2">
                <button
                  onClick={onSignOut}
                  disabled={isSigningOut}
                  className="flex w-full items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-red-50 transition-colors disabled:opacity-50">
                  <IconBox className="bg-red-50">
                    <LogOut size={16} className="text-red-400" />
                  </IconBox>
                  <p className="text-sm font-medium text-red-500">
                    {isSigningOut ? "Signing out…" : "Sign out"}
                  </p>
                </button>
              </div>

              {/* Copyright */}
              <p className="px-3 pb-8 pt-1 text-center text-[10px] text-slate-300">
                © {new Date().getFullYear()} Mahiman Singh Rathore · All rights reserved
                <span className="block mt-1 text-slate-200">build {__BUILD_ID__}</span>
              </p>

            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

const SUPPORT_RESOURCES = [
  {
    name: "Samaritans",
    desc: "Free, 24/7 listening support",
    contact: "Call 116 123",
    href: "https://www.samaritans.org",
    color: "bg-green-50 border-green-200",
    text: "text-green-800",
  },
  {
    name: "Mind",
    desc: "Mental health information & support",
    contact: "mind.org.uk",
    href: "https://www.mind.org.uk",
    color: "bg-blue-50 border-blue-200",
    text: "text-blue-800",
  },
  {
    name: "Shout",
    desc: "Free crisis text line, 24/7",
    contact: "Text SHOUT to 85258",
    href: "https://www.giveusashout.org",
    color: "bg-violet-50 border-violet-200",
    text: "text-violet-800",
  },
  {
    name: "Papyrus",
    desc: "Support for under-35s",
    contact: "Call 0800 068 4141",
    href: "https://www.papyrus-uk.org",
    color: "bg-amber-50 border-amber-200",
    text: "text-amber-800",
  },
  {
    name: "International",
    desc: "Crisis centres worldwide",
    contact: "findahelpline.com",
    href: "https://findahelpline.com",
    color: "bg-teal-50 border-teal-200",
    text: "text-teal-800",
  },
];

function SupportPanel({ onClose }) {
  return createPortal(
    <div data-portal className="fixed inset-0 z-[250] flex flex-col bg-white">
      <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 flex-shrink-0">
        <button onClick={onClose} className="rounded-full p-1.5 hover:bg-slate-100 transition-colors">
          <ArrowLeft size={18} className="text-slate-600" />
        </button>
        <h2 className="text-sm font-bold text-slate-800">If you're struggling</h2>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-3">
        <p className="text-[13px] text-slate-500 leading-relaxed pb-1">
          It's okay to not be okay. These services are free, confidential, and here whenever you need them.
        </p>

        {SUPPORT_RESOURCES.map((r) => (
          <a key={r.name} href={r.href} target="_blank" rel="noopener noreferrer"
            className={`flex items-start gap-3 rounded-2xl border ${r.color} px-4 py-3.5 transition-opacity active:opacity-70`}>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold ${r.text}`}>{r.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{r.desc}</p>
              <p className={`text-[11px] font-semibold mt-1.5 ${r.text}`}>{r.contact}</p>
            </div>
            <ArrowRight size={14} className="text-slate-300 flex-shrink-0 mt-1" />
          </a>
        ))}

        <p className="text-center text-xs text-slate-300 pt-3 pb-1">
          You don't have to face it alone.
        </p>
      </div>
    </div>,
    document.body
  );
}

const REACTION_WORD = { "❤️": "heart", "🙏": "thank you", "😊": "smile", "🌟": "star" };
const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
const ADMIN_EMAIL = "prince1489@googlemail.com";

function NotificationBell({ streak, db, currentUser }) {
  const [open, setOpen] = useState(false);
  const [waves, setWaves] = useState([]);
  const [likes, setLikes] = useState([]);
  const [circleInvites, setCircleInvites] = useState([]);
  const [dismissedLikes, setDismissedLikes] = useState(new Set());
  const [dismissedInvites, setDismissedInvites] = useState(new Set());
  const [likesSeenAt, setLikesSeenAt] = useState(() => {
    try { return Number(localStorage.getItem("seen-likes-at")) || 0; } catch { return 0; }
  });
  const prevWaveIdsRef = useRef(new Set());
  const prevLikeIdsRef = useRef(new Set());
  const likeNameCacheRef = useRef({});
  const likesSeenAtRef = useRef(likesSeenAt);
  const notifyReadyRef = useRef(false);
  useEffect(() => { likesSeenAtRef.current = likesSeenAt; }, [likesSeenAt]);
  // Don't fire notifications on initial load — only for events that arrive after mount
  useEffect(() => { const t = setTimeout(() => { notifyReadyRef.current = true; }, 2500); return () => clearTimeout(t); }, []);

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
      const newWaves = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      if (notifyReadyRef.current && typeof Notification !== "undefined" && Notification.permission === "granted") {
        newWaves.forEach((w) => {
          if (!prevWaveIdsRef.current.has(w.id)) {
            new Notification("Someone waved at you 👋", { body: "Open Seen to wave back", icon: "/favicon.svg" });
          }
        });
      }
      prevWaveIdsRef.current = new Set(newWaves.map((w) => w.id));
      setWaves(newWaves);
    }, () => {});
  }, [db, currentUser]);

  // Circle invite notifications
  useEffect(() => {
    if (!db || !currentUser) return;
    const q = query(
      collection(db, "circleInvites"),
      where("toUid", "==", currentUser.uid),
      where("status", "==", "pending")
    );
    return onSnapshot(q, (snap) => {
      setCircleInvites(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => {});
  }, [db, currentUser]);

  // Likes — someone hearted one of my messages. Every ❤️ writes a doc to
  // users/{me}/reactionsReceived, denormalized with the reactor's first name +
  // country, so we can show "Name from Country liked you" without extra reads.
  useEffect(() => {
    if (!db || !currentUser) return;
    const q = query(
      collection(db, "users", currentUser.uid, "reactionsReceived"),
      limit(20)
    );
    return onSnapshot(q, async (snap) => {
      const rows = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((r) => (r.emoji || "❤️") === "❤️" && r.reactorUid && r.reactorUid !== currentUser.uid)
        .sort((a, b) => (b.reactedAt || 0) - (a.reactedAt || 0))
        .slice(0, 15);
      const resolved = await Promise.all(rows.map(async (r) => {
        let name = (r.reactorName || "").trim();
        let country = r.country || "";
        // Older reaction docs predate the denormalized name — fall back to the
        // reactor's profile (cached per uid so we don't refetch on every snapshot).
        if (!name) {
          if (likeNameCacheRef.current[r.reactorUid]) {
            name = likeNameCacheRef.current[r.reactorUid];
          } else {
            try {
              const us = await getDoc(doc(db, "users", r.reactorUid));
              name = (us.data()?.fullName || "").trim().split(" ")[0] || "Someone";
              if (!country) country = us.data()?.country || "";
              likeNameCacheRef.current[r.reactorUid] = name;
            } catch { name = "Someone"; }
          }
        }
        return { id: r.id, name: name || "Someone", country, at: typeof r.reactedAt === "number" ? r.reactedAt : 0 };
      }));
      if (notifyReadyRef.current && typeof Notification !== "undefined" && Notification.permission === "granted") {
        resolved.forEach((l) => {
          if (!prevLikeIdsRef.current.has(l.id) && l.at > likesSeenAtRef.current) {
            new Notification(`${l.name}${l.country ? ` from ${l.country}` : ""} liked your message ❤️`, { icon: "/favicon.svg" });
          }
        });
      }
      prevLikeIdsRef.current = new Set(resolved.map((l) => l.id));
      setLikes(resolved);
    }, () => {});
  }, [db, currentUser]);

  // Mark likes as seen once the panel is opened → clears the unread badge.
  useEffect(() => {
    if (!open || likes.length === 0) return;
    const newest = likes.reduce((m, l) => Math.max(m, l.at), likesSeenAtRef.current);
    setLikesSeenAt(newest);
    try { localStorage.setItem("seen-likes-at", String(newest)); } catch (_) {}
  }, [open, likes]);

  const dismissWave = async (id) => {
    if (!db) return;
    await setDoc(doc(db, "waves", id), { read: true }, { merge: true }).catch(() => {});
  };
  const dismissAllWaves = () => waves.forEach((w) => dismissWave(w.id));
  const dismissLike = (id) => setDismissedLikes((s) => new Set(s).add(id));
  const dismissInvite = (id) => setDismissedInvites((s) => new Set(s).add(id));

  const visibleLikes = likes.filter((l) => !dismissedLikes.has(l.id));
  const visibleInvites = circleInvites.filter((inv) => !dismissedInvites.has(inv.id));
  const newLikesCount = visibleLikes.filter((l) => l.at > likesSeenAt).length;
  const totalUnread = waves.length + newLikesCount + visibleInvites.length;
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
            {waves.length === 0 && visibleLikes.length === 0 && visibleInvites.length === 0 ? (
              <p className="px-4 py-6 text-center text-[11px] text-slate-400">No new notifications</p>
            ) : (
              <div className="py-1">
                {visibleInvites.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-teal-50">
                    <span className="text-base flex-shrink-0">{inv.circleEmoji ?? "⭐"}</span>
                    <p className="flex-1 text-[11px] text-slate-700 min-w-0">
                      <span className="font-semibold">{inv.fromName ?? "Someone"}</span> invited you to join{" "}
                      <span className="font-semibold text-teal-700">{inv.circleName}</span>
                      <span className="text-slate-400 block">Open ··· → Circles to accept</span>
                    </p>
                    <button onClick={() => dismissInvite(inv.id)}
                      className="flex-shrink-0 flex h-6 w-6 items-center justify-center text-slate-300 hover:text-slate-500">
                      <X size={12} />
                    </button>
                  </div>
                ))}
                {visibleInvites.length > 0 && (waves.length > 0 || visibleLikes.length > 0) && (
                  <div className="mx-4 my-1 border-t border-slate-100" />
                )}
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
                {waves.length > 0 && visibleLikes.length > 0 && (
                  <div className="mx-4 my-1 border-t border-slate-100" />
                )}
                {visibleLikes.map((l) => {
                  const fresh = l.at > likesSeenAt;
                  return (
                    <div key={l.id} className={`flex items-center gap-2.5 px-4 py-2.5 ${fresh ? "bg-rose-50/60" : ""} hover:bg-rose-50`}>
                      <span className="text-base flex-shrink-0">❤️</span>
                      <p className="flex-1 text-[11px] text-slate-700 min-w-0">
                        <span className="font-semibold">{l.name}</span>
                        {l.country ? <> from <span className="font-semibold">{l.country}</span></> : null}
                        {" "}liked your message ❤️
                      </p>
                      <button onClick={() => dismissLike(l.id)}
                        className="flex-shrink-0 flex h-6 w-6 items-center justify-center text-slate-300 hover:text-slate-500">
                        <X size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          {(waves.length > 1 || visibleLikes.length > 0 || visibleInvites.length > 0) && (
            <div className="border-t border-slate-100 px-4 py-2">
              <button
                onClick={() => {
                  dismissAllWaves();
                  visibleLikes.forEach((l) => dismissLike(l.id));
                  visibleInvites.forEach((inv) => dismissInvite(inv.id));
                }}
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

  const valid = Boolean(form.country) && Boolean(form.email);

  const onChange = (e) => { const { name, value } = e.target; setForm((prev) => ({ ...prev, [name]: value })); };

  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-teal-600" /></div>;

  return (
    <div className="h-full w-full bg-gradient-to-b from-[#edf5f6] via-[#f7f7f6] to-[#f6f5f2] px-6 pt-8 pb-6">
      <form className="mx-auto w-full max-w-sm space-y-3"
        onSubmit={(e) => { e.preventDefault(); if (!valid) return; onContinue({ ...form, dob: (form.dobMonth && form.dobDay && form.dobYear) ? `${form.dobMonth} ${form.dobDay}, ${form.dobYear}` : "" }); }}>
        <div className="flex justify-center pb-3">
          <div className="rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-400 p-4 text-white shadow-md">
            <Sparkles size={24} />
          </div>
        </div>
        <h1 className="font-display text-center text-[42px] leading-[1.05] font-normal tracking-[-0.04em] text-slate-800">Welcome to Seen</h1>
        <p className="pb-4 text-center text-[20px] leading-tight text-slate-500">Tell us a bit about yourself to start connecting.</p>

        <InputRow icon={Globe} rightIcon={<ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />}>
          <select name="country" value={form.country} onChange={onChange}
            className="w-full appearance-none rounded-2xl border border-slate-300 bg-slate-50 py-3.5 pr-10 pl-11 text-base text-slate-500">
            <option value="">Select Country</option>
            {COUNTRY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </InputRow>

        <InputRow icon={User}>
          <input name="fullName" value={form.fullName} onChange={onChange} placeholder="Full Name (optional)"
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
            <Calendar size={13} /><span>Date of Birth <span className="font-normal normal-case tracking-normal text-slate-400">(optional)</span></span>
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
        <h2 className="mt-2 font-display text-[28px] font-normal tracking-[-0.04em] text-slate-800">You unlocked a bonus!</h2>
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
  const isPremium = true;
  const categories = getGreetingsByCategory(isPremium);
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? "core");

  const activeGreetings = categories.find((c) => c.id === activeCategory)?.greetings ?? [];
  const theme = getCurrentMonthTheme();
  const allCategories = [
    { id: "core",      label: "Greetings",       emoji: "☀️",  isPremium: false },
    { id: "warmth",    label: "Warmth",           emoji: "💛",  isPremium: false },
    { id: "calm",      label: "Calm",             emoji: "🌿",  isPremium: false },
    { id: "strength",  label: "Strength",         emoji: "💪",  isPremium: true  },
    { id: "celebrate", label: "Celebrate",        emoji: "🎉",  isPremium: true  },
    { id: "cultural",  label: "World",            emoji: "🌍",  isPremium: true  },
    { id: "themed",    label: theme?.name ?? "This Month", emoji: theme?.emoji ?? "🗓️", isPremium: true },
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
              {locked && <span className="text-[10px]">🔒</span>}
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


function SparkRing({ value, max, percent, initial = "✨" }) {
  const size = 52, stroke = 3, r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const filled = circ * (percent / 100);
  const isLetter = initial.length === 1 && /[A-Za-z]/.test(initial);
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="url(#sparkGrad)" strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ - filled}
          style={{ transition: "stroke-dashoffset 0.85s cubic-bezier(0.34,1.2,0.64,1)" }} />
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#2dd4bf" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center rounded-full"
        style={{ background: "rgba(255,255,255,0.05)" }}>
        <span style={{
          fontSize: isLetter ? "17px" : "11px",
          fontWeight: isLetter ? 700 : 700,
          color: isLetter ? "#e2e8f0" : "#0f766e",
          lineHeight: 1,
          fontFamily: isLetter ? "Inter, sans-serif" : "inherit",
        }}>{initial}</span>
      </div>
    </div>
  );
}

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    try { const v = localStorage.getItem("seen-theme"); return v !== null ? v === "dark" : true; }
    catch { return true; }
  });
  useEffect(() => {
    try { localStorage.setItem("seen-theme", darkMode ? "dark" : "light"); } catch {}
  }, [darkMode]);

  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  // True only once a profile read has *positively* resolved (doc found or confirmed missing).
  // Gates the onboarding screen so a transient read error never flashes it for an existing user.
  const [profileChecked, setProfileChecked] = useState(false);
  // True when this device has recorded a completed onboarding for the signed-in user —
  // a timing-independent backstop against the onboarding screen flashing on reopen.
  const [knownOnboarded, setKnownOnboarded] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState("");
  const [messages, setMessages] = useState([]);
  const [isChatLive, setIsChatLive] = useState(false);
  const [chatError, setChatError] = useState("");
  const [lastLiveAt, setLastLiveAt] = useState(null);
  const [chatRetryCount, setChatRetryCount] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sendError, setSendError] = useState("");
  // Buddy invite: detect ?add=UID in URL
  const [pendingBuddyUid] = useState(() => {
    try { return new URLSearchParams(window.location.search).get("add") || null; } catch { return null; }
  });
  // Referral: detect ?ref=UID in URL and persist to localStorage
  const [pendingReferralUid] = useState(() => {
    try { return new URLSearchParams(window.location.search).get("ref") || null; } catch { return null; }
  });
  const [isSending, setIsSending] = useState(false);
  const [headerOpen, setHeaderOpen] = useState(false);
  // ── Tap-to-reveal timestamp / long-press reaction bar ──
  const [activeMessageId, setActiveMessageId] = useState(null);
  const [reactionBarId, setReactionBarId] = useState(null);
  const [localHeartedMessageIds, setLocalHeartedMessageIds] = useState(new Set());
  const longPressTimer = useRef(null);
  const longPressTriggered = useRef(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState("entry");
  const [showWelcomeMoment, setShowWelcomeMoment] = useState(false);
  const [showSupport, setShowSupport] = useState(false);
  const [pendingProfileData, setPendingProfileData] = useState(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [isEmailActionLoading, setIsEmailActionLoading] = useState(false);
  const [emailLinkMessage, setEmailLinkMessage] = useState("");
  const [authError, setAuthError] = useState("");
  const [onboardingError, setOnboardingError] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [activeTab, setActiveTab] = useState("feed");
  const [showMapPrompt, setShowMapPrompt] = useState(false);
  const [lastSendTime, setLastSendTime] = useState(() => {
    try { return parseInt(localStorage.getItem("seen_last_send_time") || "0", 10) || 0; } catch (_) { return 0; }
  });
  const [hasSent, setHasSent] = useState(() => !!localStorage.getItem("seen_has_sent"));
  // Countries that reacted to MY messages → { [country]: { emoji, at } }, persisted 5h
  const [reactedCountries, setReactedCountries] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("seen_reacted_v1") || "{}");
      const now = Date.now();
      const pruned = {};
      for (const [c, v] of Object.entries(raw)) if (v && now - v.at < FIVE_HOURS_MS) pruned[c] = v;
      return pruned;
    } catch (_) { return {}; }
  });
  const [reactionToast, setReactionToast] = useState(null); // { id, emoji, country }
  const [hometownToast, setHometownToast] = useState(null); // { id, emoji } — same-country reaction
  const [hometownPingTime, setHometownPingTime] = useState(0); // last same-country event timestamp for globe ripple
  const [newRippleCountry, setNewRippleCountry] = useState(null); // last responder's country for ripple arc on globe
  const reactObservedRef = useRef(new Set());
  const reactReadyRef = useRef(false);
  const myCountryRef = useRef(null); // kept in sync with profile.country for reaction listener closure
  const lastReachWriteRef = useRef(null); // last reactionsReceivedCount written to my profile (avoid redundant writes)
  const [unauthScreen, setUnauthScreen] = useState(
    localStorage.getItem("seen_intro_v1") ? "welcome" : "intro"
  );
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [mysteryReward, setMysteryReward] = useState(0);
  // Mystery unwrap: { [messageId]: revealedText } persisted to localStorage
  const [unwrappedMysteries, setUnwrappedMysteries] = useState(() => {
    try { return JSON.parse(localStorage.getItem("seen-mystery-reveals") || "{}"); }
    catch (_) { return {}; }
  });
  const [burstingMystery, setBurstingMystery] = useState(null);
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [premiumSuccess, setPremiumSuccess] = useState(false);
  // Detect Stripe checkout return
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("premium") === "success") {
      setPremiumSuccess(true);
      window.history.replaceState({}, "", "/");
      setTimeout(() => setPremiumSuccess(false), 5000);
    }
  }, []);
  // PWA install prompt
  const deferredInstallRef = useRef(null);
  const [showInstallBanner, setShowInstallBanner] = useState(() => {
    try { return !localStorage.getItem("seen-install-dismissed"); } catch { return false; }
  });
  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) { setShowInstallBanner(false); return; }
    if ("getInstalledRelatedApps" in navigator) {
      navigator.getInstalledRelatedApps().then((apps) => {
        if (apps.some((a) => a.id === "app.seenapp.twa")) setShowInstallBanner(false);
      }).catch(() => {});
    }
    const handler = (e) => { e.preventDefault(); deferredInstallRef.current = e; };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  const handleInstall = async () => {
    if (!deferredInstallRef.current) return;
    deferredInstallRef.current.prompt();
    await deferredInstallRef.current.userChoice;
    deferredInstallRef.current = null;
    setShowInstallBanner(false);
    try { localStorage.setItem("seen-install-dismissed", "1"); } catch (_) {}
  };
  const dismissInstallBanner = () => {
    setShowInstallBanner(false);
    try { localStorage.setItem("seen-install-dismissed", "1"); } catch (_) {}
  };

  // FCM push token — register when notification permission is granted
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  useEffect(() => {
    if (!currentUser || notifPermission !== "granted" || !messaging) return;
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) return;
    navigator.serviceWorker.ready.then((reg) => {
      getToken(messaging, { vapidKey, serviceWorkerRegistration: reg })
        .then((token) => {
          if (token) setDoc(doc(db, "users", currentUser.uid), { fcmToken: token }, { merge: true }).catch(() => {});
        })
        .catch(() => {});
    }).catch(() => {});
  }, [currentUser, db, notifPermission]);
  // Suppress foreground FCM messages — Firestore onSnapshot handles them in the bell
  useEffect(() => {
    if (!messaging) return;
    return onMessage(messaging, () => {});
  }, []);

  // Sync myCountry into a ref so the reactions listener closure always reads the latest value
  useEffect(() => { myCountryRef.current = profile?.country ?? null; }, [profile]);

  // Auto-dismiss map prompt after 7s
  useEffect(() => {
    if (!showMapPrompt) return;
    const t = setTimeout(() => setShowMapPrompt(false), 7000);
    return () => clearTimeout(t);
  }, [showMapPrompt]);

  // Listen for reactions on MY messages → light reactor countries (5h) + fire named toast
  useEffect(() => {
    if (!db || !currentUser) return;
    reactReadyRef.current = false;
    const readyTimer = setTimeout(() => { reactReadyRef.current = true; }, 4000);
    const q = query(collection(db, "publicMessages"), where("uid", "==", currentUser.uid), orderBy("timestamp", "desc"), limit(20));
    // Stable per-message subscription map (msgId → unsub). We diff on each outer fire and
    // only attach/detach what actually changed — never a blanket teardown — so an inner
    // reactions listener, once attached, keeps delivering heart updates for the whole session.
    const innerSubs = new Map();
    const outer = onSnapshot(q, (snap) => {
      const liveIds = new Set();
      snap.docs.forEach((d) => {
        const msgId = d.id;
        liveIds.add(msgId);
        if (innerSubs.has(msgId)) return; // already subscribed — leave it alone
        // Message send time (ms) — fallback reaction time for legacy reaction docs lacking
        // reactedAt. timestamp is written as a number (nowMs()), so read it as a number;
        // only call .toMillis() if it's actually a Firestore Timestamp.
        const ts = d.data().timestamp;
        const msgTs = typeof ts === "number" ? ts : (ts?.toMillis?.() ?? 0);
        const unsub = onSnapshot(collection(db, "publicMessages", msgId, "reactions"), (rSnap) => {
          const newToasts = [];
          rSnap.forEach((rDoc) => {
            const REACT_EMOJIS = new Set(["❤️", "🙏", "😊", "🌟"]);
            if (!REACT_EMOJIS.has(rDoc.id)) return;
            const emoji = rDoc.id;
            const data = rDoc.data();
            const countries = data.countries || {};
            const reactedAt = data.reactedAt || {};
            (data.uids || []).forEach((uid) => {
              if (uid === currentUser.uid) return;
              const country = countries[uid];
              if (!country) {
                // Fallback: fetch country from users doc (handles reactions written by older app
                // builds that didn't store the countries map, or when profile was null at react time).
                getDoc(doc(db, "users", uid)).then(snap => {
                  const c = snap.data()?.country;
                  if (!c) return;
                  const at2 = reactedAt[uid] ?? msgTs;
                  setReactedCountries(prev => {
                    const existing = prev[c];
                    if (existing && existing.at >= at2) return prev;
                    const next = { ...prev, [c]: { emoji, at: at2 } };
                    try { localStorage.setItem("seen_reacted_v1", JSON.stringify(next)); } catch (_) {}
                    return next;
                  });
                }).catch(() => {});
                return;
              }

              // Use the reactor's real timestamp from Firestore. Legacy reactions
              // written by older builds lack reactedAt — fall back to the message's
              // send time (a heart can't precede its message), so they still light
              // coral and age out naturally via the 5h TTL.
              const at = reactedAt[uid] ?? msgTs;
              setReactedCountries((prev) => {
                const existing = prev[country];
                // Keep the newest reaction time per country.
                if (existing && existing.at >= at) return prev;
                const next = { ...prev, [country]: { emoji, at } };
                try { localStorage.setItem("seen_reacted_v1", JSON.stringify(next)); } catch (_) {}
                return next;
              });

              // Toast fires only ONCE per message+user+emoji (not per country — so UK re-reacts correctly)
              const toastKey = `${msgId}|${uid}|${emoji}`;
              if (reactObservedRef.current.has(toastKey)) return;
              reactObservedRef.current.add(toastKey);
              if (reactReadyRef.current) {
                if (country === myCountryRef.current && myCountryRef.current) {
                  // Same-country reaction — hometown toast + globe ripple
                  setHometownToast({ id: Date.now(), emoji });
                  setHometownPingTime(Date.now());
                } else {
                  newToasts.push({ emoji, country });
                }
              }
            });
          });
          if (newToasts.length) {
            const t0 = newToasts[newToasts.length - 1];
            setReactionToast({ id: Date.now(), emoji: t0.emoji, country: t0.country });
          }
        }, (e) => console.warn("[reactions] inner listener error", e));
        innerSubs.set(msgId, unsub);
      });
      // Detach listeners for messages that dropped out of the top-20 window
      for (const [msgId, unsub] of innerSubs) {
        if (!liveIds.has(msgId)) { unsub(); innerSubs.delete(msgId); }
      }
    }, (e) => console.warn("[reactions] outer listener error", e));
    return () => {
      clearTimeout(readyTimer);
      outer();
      for (const unsub of innerSubs.values()) unsub();
      innerSubs.clear();
    };
  }, [db, currentUser]);

  // Robust live coral lighting: a single flat listener on my own reactionsReceived
  // subcollection. Each heart writes a doc here (denormalized at react time), so this
  // delivers the event instantly without depending on the per-message reactions
  // listeners above re-firing. Belt-and-suspenders with the listener above — both feed
  // the same reactedCountries state with an idempotent "keep newest at" guard.
  useEffect(() => {
    if (!db || !currentUser) return;
    const col = collection(db, "users", currentUser.uid, "reactionsReceived");
    const unsub = onSnapshot(col, (snap) => {
      const newToasts = [];
      snap.docChanges().forEach((chg) => {
        if (chg.type === "removed") return; // un-heart: let the 5h TTL fade coral
        const data = chg.doc.data();
        const reactorUid = data.reactorUid;
        const emoji = data.emoji || "❤️";
        const messageId = data.messageId;
        if (!reactorUid || reactorUid === currentUser.uid) return;
        const at = typeof data.reactedAt === "number" ? data.reactedAt : Date.now();

        const applyCountry = (country) => {
          if (!country) return;
          setReactedCountries((prev) => {
            const existing = prev[country];
            if (existing && existing.at >= at) return prev;
            const next = { ...prev, [country]: { emoji, at } };
            try { localStorage.setItem("seen_reacted_v1", JSON.stringify(next)); } catch (_) {}
            return next;
          });
        };
        if (data.country) applyCountry(data.country);
        else getDoc(doc(db, "users", reactorUid))
          .then((s) => applyCountry(s.data()?.country))
          .catch((e) => console.warn("[reactionsReceived] country fallback failed", e));

        // Toast once per message+user+emoji — shared dedupe with the listener above
        const toastKey = `${messageId}|${reactorUid}|${emoji}`;
        if (reactObservedRef.current.has(toastKey)) return;
        reactObservedRef.current.add(toastKey);
        if (reactReadyRef.current && data.country) {
          if (data.country === myCountryRef.current && myCountryRef.current) {
            setHometownToast({ id: Date.now(), emoji });
            setHometownPingTime(Date.now());
          } else {
            newToasts.push({ emoji, country: data.country });
          }
        }
      });
      if (newToasts.length) {
        const t0 = newToasts[newToasts.length - 1];
        setReactionToast({ id: Date.now(), emoji: t0.emoji, country: t0.country });
      }

      // Denormalize total likes received onto my own profile so OTHER users can read it
      // (they can read my profile but not this subcollection). Powers "Onward Reach".
      const totalLikes = snap.size;
      if (totalLikes !== lastReachWriteRef.current) {
        lastReachWriteRef.current = totalLikes;
        updateDoc(doc(db, "users", currentUser.uid), { reactionsReceivedCount: totalLikes }).catch(() => {});
      }
    }, (e) => console.warn("[reactionsReceived] listener error", e));
    return () => unsub();
  }, [db, currentUser]);

  // Watch ripples — when a new ripple is credited, fire a globe arc outward to the responder's country.
  useEffect(() => {
    if (!db || !currentUser) return;
    let initialLoad = true;
    const unsub = onSnapshot(
      collection(db, "users", currentUser.uid, "ripples"),
      (snap) => {
        if (initialLoad) { initialLoad = false; return; } // skip initial snapshot
        snap.docChanges().forEach((chg) => {
          if (chg.type !== "added") return;
          const country = chg.doc.data()?.responderCountry;
          if (country && COUNTRY_COORDS[country]) setNewRippleCountry(country);
        });
      },
      () => {}
    );
    return () => unsub();
  }, [db, currentUser]);

  // Listen for admin full-reset signal — clears stale globe localStorage on ALL clients
  useEffect(() => {
    if (!db) return;
    return onSnapshot(doc(db, "meta", "appState"), (snap) => {
      const lastResetAt = snap.data()?.lastResetAt ?? 0;
      if (!lastResetAt) return;
      try {
        const stored = localStorage.getItem("seen_reacted_v1");
        if (!stored) return;
        const data = JSON.parse(stored);
        // Drop any country entry whose reaction predates the last reset
        const filtered = Object.fromEntries(
          Object.entries(data).filter(([, v]) => (v?.at ?? 0) >= lastResetAt)
        );
        if (Object.keys(filtered).length !== Object.keys(data).length) {
          if (Object.keys(filtered).length === 0) {
            localStorage.removeItem("seen_reacted_v1");
          } else {
            localStorage.setItem("seen_reacted_v1", JSON.stringify(filtered));
          }
          setReactedCountries(filtered);
        }
      } catch (_) {}
    }, () => {});
  }, [db]);

  // One-time cleanup: delete legacy non-heart reaction docs from Firestore
  useEffect(() => {
    if (!db || !currentUser) return;
    const DONE_KEY = "seen_reaction_cleanup_v1";
    if (localStorage.getItem(DONE_KEY)) return;
    const run = async () => {
      try {
        const q = query(collection(db, "publicMessages"), orderBy("timestamp", "desc"), limit(50));
        const msgs = await getDocs(q);
        const deletes = [];
        for (const msgDoc of msgs.docs) {
          const rSnap = await getDocs(collection(db, "publicMessages", msgDoc.id, "reactions"));
          rSnap.forEach((rDoc) => {
            if (rDoc.id !== "❤️" && !rDoc.id.startsWith("sticker_")) {
              deletes.push(deleteDoc(rDoc.ref));
            }
          });
        }
        await Promise.all(deletes);
        localStorage.setItem(DONE_KEY, "1");
      } catch (_) {}
    };
    run();
  }, [db, currentUser]);

  // Prune reactor lighting older than 5h once a minute
  useEffect(() => {
    const iv = setInterval(() => {
      setReactedCountries((prev) => {
        const now = Date.now();
        let changed = false;
        const next = {};
        for (const [c, v] of Object.entries(prev)) {
          if (now - v.at < FIVE_HOURS_MS) next[c] = v; else changed = true;
        }
        if (changed) { try { localStorage.setItem("seen_reacted_v1", JSON.stringify(next)); } catch (_) {} return next; }
        return prev;
      });
    }, 60000);
    return () => clearInterval(iv);

  }, []);

  // Auto-dismiss reaction toast after 6s
  useEffect(() => {
    if (!reactionToast) return;
    const t = setTimeout(() => setReactionToast(null), 6000);
    return () => clearTimeout(t);
  }, [reactionToast]);

  // Auto-dismiss hometown toast after 7s
  useEffect(() => {
    if (!hometownToast) return;
    const t = setTimeout(() => setHometownToast(null), 7000);
    return () => clearTimeout(t);
  }, [hometownToast]);
  // Private chat
  const [showChatInbox, setShowChatInbox] = useState(false);
  const [activeChat, setActiveChat] = useState(null); // { chatId, otherUid, otherName }
  const [showMap, setShowMap] = useState(false);
  const [newMessageIds, setNewMessageIds] = useState(new Set());
  const [seenCountries, setSeenCountries] = useState(new Set());
  const prevMessagesRef = useRef([]);

  const endRef = useRef(null);
  const isRealSignedInUser = Boolean(currentUser && !currentUser.isAnonymous);
  const isAdmin = currentUser?.email === ADMIN_EMAIL;
  const [adminConfirm, setAdminConfirm] = useState(false); // two-step clear-chat confirmation
  const [adminClearing, setAdminClearing] = useState(false);
  const [adminClearError, setAdminClearError] = useState("");
  const [adminResetConfirm, setAdminResetConfirm] = useState(false);
  const [adminResetting, setAdminResetting] = useState(false);
  const [adminResetError, setAdminResetError] = useState("");
  const [adminReports, setAdminReports] = useState(null); // null = not loaded
  const [adminReportsLoading, setAdminReportsLoading] = useState(false);
  const [showResolvedReports, setShowResolvedReports] = useState(false);
  const userProfileRef = (uid) => doc(db, "users", uid);
  const publicMessagesRef = collection(db, "publicMessages");

  const { streak, freezesAvailable, recordGreetingDay, buyFreeze, useFreeze, sellFreeze } =
    useStreak(db, currentUser?.uid, profile);

  const anim = useAnimations();
  const { burst: reactionBurst, trigger: triggerReactionBurst } = useReactionBurst();
  const pendingChatCount = usePendingChatCount(db, isRealSignedInUser ? currentUser : null);
  const unreadMsgCount = usePrivateUnreadCount(db, isRealSignedInUser ? currentUser : null);
  const chatBadgeCount = pendingChatCount + unreadMsgCount;

  useEffect(() => {
    let unsubscribeProfile = null;
    let retryTimer = null;
    let attempts = 0;

    const subscribeProfile = (user) => {
      const onboardedKey = "seen_onboarded_" + user.uid;
      // includeMetadataChanges so the server's confirmation fires even when the cached
      // "no document" matches it — otherwise a brand-new user could hang on the loader.
      unsubscribeProfile = onSnapshot(userProfileRef(user.uid), { includeMetadataChanges: true },
        (snap) => {
          // Ignore a transient "no document" served from the local cache before the
          // server has responded — without this it briefly looks like the user has no
          // profile and the onboarding screen flashes for an already-onboarded user.
          if (!snap.exists() && snap.metadata?.fromCache) return;
          const nextProfile = snap.exists() ? snap.data() : null;
          const done = Boolean(nextProfile?.onboardingCompletedAt) || Boolean(nextProfile?.fullName && nextProfile?.country && nextProfile?.dob);
          setProfile(nextProfile);
          setHasCompletedOnboarding(done); setOnboardingStep(done ? "done" : "details");
          // Remember on this device that onboarding is done, so a future cold start never
          // flashes the onboarding screen even if the profile read is momentarily empty.
          if (done) safeLocalSet(onboardedKey, "1");
          attempts = 0;
          setProfileLoadError(""); setProfileChecked(true); setIsProfileLoading(false);
        },
        (error) => {
          // A profile read can transiently fail on cold start (e.g. auth token not yet
          // attached). Do NOT flash the onboarding screen — keep the loader up and retry
          // with backoff so an already-onboarded user goes straight to the feed.
          if (unsubscribeProfile) { unsubscribeProfile(); unsubscribeProfile = null; }
          attempts += 1;
          if (attempts <= 4 && auth.currentUser) {
            retryTimer = setTimeout(() => {
              if (auth.currentUser) subscribeProfile(auth.currentUser);
            }, Math.min(8000, 1000 * 2 ** (attempts - 1)));
          } else {
            // Exhausted retries: surface a recoverable error instead of hanging forever.
            setProfileLoadError(error?.code || "unknown"); setIsProfileLoading(false);
          }
        }
      );
    };

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeProfile) { unsubscribeProfile(); unsubscribeProfile = null; }
      if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
      attempts = 0;
      setCurrentUser(user); setIsAuthLoading(false); setAuthError(""); setEmailLinkMessage("");
      if (!user || user.isAnonymous) {
        setProfile(null); setHasCompletedOnboarding(false); setOnboardingStep("entry");
        setUnauthScreen("welcome"); setOnboardingError("");
        setKnownOnboarded(false);
        setProfileChecked(true); setIsProfileLoading(false); return;
      }
      setKnownOnboarded(safeLocalGet("seen_onboarded_" + user.uid) === "1");
      setProfileChecked(false); setProfileLoadError(""); setIsProfileLoading(true);
      subscribeProfile(user);
    });
    return () => {
      if (unsubscribeProfile) unsubscribeProfile();
      if (retryTimer) clearTimeout(retryTimer);
      unsubscribeAuth();
    };
  }, []);

  // Persist referral code and clean URL
  useEffect(() => {
    if (!pendingReferralUid) return;
    try {
      localStorage.setItem("seen_ref", pendingReferralUid);
      const url = new URL(window.location.href);
      url.searchParams.delete("ref");
      window.history.replaceState({}, "", url.toString());
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-add buddy from invite link (?add=UID)
  useEffect(() => {
    if (!pendingBuddyUid || !isRealSignedInUser || !db || !currentUser) return;
    // Remove param from URL without reload
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("add");
      window.history.replaceState({}, "", url.toString());
    } catch {}
    // Don't add yourself
    if (pendingBuddyUid === currentUser.uid) return;
    updateDoc(doc(db, "users", currentUser.uid), { buddies: arrayUnion(pendingBuddyUid) }).catch(() => {});
  }, [pendingBuddyUid, isRealSignedInUser, db, currentUser]);

  useEffect(() => {
    if (isRealSignedInUser && hasCompletedOnboarding) scheduleGreetingWindowNotification(profile);
  }, [isRealSignedInUser, hasCompletedOnboarding]);

  // Re-engagement: when user leaves the app, schedule a "come back" push for 9 AM tomorrow
  useEffect(() => {
    if (!isRealSignedInUser || !hasCompletedOnboarding) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    let retryTimer = null;
    const MESSAGES = [
      { title: "Seen misses you 💌", body: "Someone out there is waiting to hear something kind from you." },
      { title: "Your streak is waiting 🔥", body: "Keep the kindness going — open Seen and spread some warmth." },
      { title: "Today's Wonderful News is in 🌟", body: "Start your day with something uplifting." },
    ];
    const scheduleReEngagement = () => {
      if (retryTimer) clearTimeout(retryTimer);
      const now = new Date();
      const target = new Date(now);
      target.setDate(target.getDate() + 1);
      target.setHours(9, 0, 0, 0);
      const msg = MESSAGES[new Date().getDay() % MESSAGES.length];
      retryTimer = setTimeout(() => new Notification(msg.title, { body: msg.body, icon: "/favicon.svg" }), target.getTime() - now.getTime());
    };
    const onVisibilityChange = () => {
      if (document.hidden) scheduleReEngagement();
      else { if (retryTimer) clearTimeout(retryTimer); }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => { document.removeEventListener("visibilitychange", onVisibilityChange); if (retryTimer) clearTimeout(retryTimer); };
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
      if (error?.code === "auth/operation-not-allowed") return { error: "Email link sign-in is not enabled — contact support." };
      if (error?.code === "auth/too-many-requests") return { error: "Too many attempts. Please try again later." };
      if (error?.code === "auth/network-request-failed") return { error: "Network error — please check your connection." };
      return { error: `Unable to send a sign-in link right now. (${error?.code ?? "unknown"})` };
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
    const q = query(publicMessagesRef, orderBy("timestamp", "asc"), limitToLast(100));
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

  const isPremium = true; // all features free — grow the user base
  const circles = useCircles(db, currentUser);
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

  const liveImpact = useMemo(() => {
    const weekAgo = Date.now() - 7 * 86400000;
    const monthAgo = Date.now() - 30 * 86400000;
    const uid = currentUser?.uid;
    const sent7d = messages.filter(m => m.uid === uid && m.timestamp >= weekAgo).length;
    const sent30d = messages.filter(m => m.uid === uid && m.timestamp >= monthAgo).length;
    const countries7d = new Set(messages.filter(m => m.uid !== uid && m.timestamp >= weekAgo && m.country).map(m => m.country)).size;
    const countries30d = new Set(messages.filter(m => m.uid !== uid && m.timestamp >= monthAgo && m.country).map(m => m.country)).size;
    return { sent7d, sent30d, countries7d, countries30d };
  }, [messages, currentUser]);

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

      // Referral reward — award +50 Sparks to both users
      const pendingRef = localStorage.getItem("seen_ref");
      if (pendingRef && pendingRef !== user.uid) {
        try {
          const referralDocRef = doc(db, "referrals", user.uid);
          const newUserRef = userProfileRef(user.uid);
          const referrerRef = doc(db, "users", pendingRef);
          await runTransaction(db, async (tx) => {
            const [existing, referrerSnap, newUserSnap] = await Promise.all([
              tx.get(referralDocRef), tx.get(referrerRef), tx.get(newUserRef),
            ]);
            if (existing.exists()) return; // already rewarded
            if (!referrerSnap.exists()) return; // invalid referrer
            const referrerSparks = referrerSnap.data().sparkBalance ?? 0;
            const newUserSparks = newUserSnap.exists() ? (newUserSnap.data().sparkBalance ?? 0) : 0;
            tx.set(referralDocRef, { referrerUid: pendingRef, newUserUid: user.uid, awardedAt: serverTimestamp() });
            tx.update(referrerRef, { sparkBalance: referrerSparks + 50 });
            tx.set(newUserRef, { sparkBalance: newUserSparks + 50 }, { merge: true });
          });
          localStorage.removeItem("seen_ref");
        } catch (err) { console.error("Referral award error:", err); }
      }

      setPendingProfileData(null); setHasCompletedOnboarding(true); setOnboardingStep("done"); setShowWelcomeMoment(true);
    } catch (error) {
      if (error?.code === "storage/unauthorized") { setOnboardingError("Storage rules are blocking photo upload."); return; }
      if (error?.code === "permission-denied") { setOnboardingError("Firestore rules are blocking profile save."); return; }
      if (error?.code === "unavailable") { setOnboardingError("Firebase is temporarily unavailable."); return; }
      setOnboardingError(error?.code ? `Unable to save your profile (${error.code}).` : "Unable to save your profile right now.");
    } finally { setIsSavingProfile(false); }
  };

  const DAILY_GREETING_LIMIT = 50;
  const haptic = (pattern = [8]) => { try { navigator.vibrate?.(pattern); } catch(_) {} };

  const handleUnwrapMystery = (messageId) => {
    if (unwrappedMysteries[messageId]) return;
    const msg = MYSTERY_MESSAGES[Math.floor(Math.random() * MYSTERY_MESSAGES.length)];
    try {
      const saved = JSON.parse(localStorage.getItem("seen-mystery-reveals") || "{}");
      saved[messageId] = msg;
      localStorage.setItem("seen-mystery-reveals", JSON.stringify(saved));
    } catch (_) {}
    setUnwrappedMysteries((prev) => ({ ...prev, [messageId]: msg }));
    setBurstingMystery(messageId);
    triggerReactionBurst("🎁");
    haptic([10, 25, 10, 25, 10]);
    setTimeout(() => setBurstingMystery(null), 600);
  };

  // Ripple attribution: convert my recent reactions into "ripple" credits for the
  // people whose greetings I reacted to. Only reactions within the window count, and
  // each original sender is credited at most once (doc id = my uid). Best-effort.
  const RIPPLE_WINDOW_MS = 48 * 60 * 60 * 1000;
  const recordRipples = async () => {
    if (!currentUser) return;
    try {
      const cutoff = Date.now() - RIPPLE_WINDOW_MS;
      const myReactionsRef = collection(db, "users", currentUser.uid, "outgoingReactions");
      // Equality-only query (no composite index needed); window is applied client-side.
      const q = query(myReactionsRef, where("converted", "==", false), limit(50));
      const snap = await getDocs(q);
      if (snap.empty) return;
      const now = Date.now();
      const myCountry = profile?.country ?? null;
      const seenSenders = new Set();
      await Promise.all(
        snap.docs.map(async (d) => {
          const { senderUid, reactedAt } = d.data();
          // Outside the window, self-reaction, or malformed — nothing to credit, but
          // mark it processed so it can't clog future scans.
          if (!reactedAt || reactedAt < cutoff || !senderUid || senderUid === currentUser.uid) {
            return setDoc(d.ref, { converted: true }, { merge: true }).catch(() => {});
          }
          const writes = [setDoc(d.ref, { converted: true }, { merge: true }).catch(() => {})];
          if (!seenSenders.has(senderUid)) {
            seenSenders.add(senderUid);
            writes.push(
              setDoc(
                doc(db, "users", senderUid, "ripples", currentUser.uid),
                {
                  originatorUid: senderUid,
                  responderUid: currentUser.uid,
                  reactedAt: reactedAt ?? null,
                  greetedAt: now,
                  responderCountry: myCountry,
                  createdAt: now,
                },
                { merge: true }
              ).catch((err) => { console.error("[ripple write]", err?.code, err?.message); })
            );
          }
          return Promise.all(writes);
        })
      );
    } catch (err) {
      console.error("[recordRipples]", err?.code, err?.message);
    }
  };

  const handleSendMessage = async (greeting) => {
    if (!currentUser || !profile || isSending) return;
    if (todayMessageCount >= DAILY_GREETING_LIMIT) return;
    setIsSending(true);
    setSendError("");
    try {
      const earnedSparks = computeSparkReward(greeting.sparkReward, streak);
      await addDoc(publicMessagesRef, {
        uid: currentUser.uid,
        sender: profile.fullName,
        text: greeting.text,
        timestamp: nowMs(),
        moodTag: profile?.moodTag ?? null,
        country: profile?.country ?? null,
        isMystery: greeting.isMystery ?? false,
        isPremium: isPremium,
        sparkReward: earnedSparks,
      });

      // Message is written — close picker and play animations immediately
      setPickerOpen(false);
      setIsSending(false);
      const newStreak = streak + 1;
      anim.triggerSparkBurst(85, 92);
      haptic([10, 30, 10]);
      const sendTs = Date.now();
      setLastSendTime(sendTs);
      try { localStorage.setItem("seen_last_send_time", String(sendTs)); } catch (_) {}
      // Bust the impact cache so the next tab open reflects this new greeting
      try { ["7d","30d"].forEach(p => localStorage.removeItem(`seen_react_v1_${p}_${currentUser.uid}`)); } catch (_) {}
      if (!hasSent) {
        // First send ever — skip the prompt, open the globe automatically so they
        // see their arc flying to another country.
        setHasSent(true);
        try { localStorage.setItem("seen_has_sent", "1"); } catch (_) {}
        setTimeout(() => setShowMap(true), 1100);
      } else {
        setShowMapPrompt(true);
      }
      if ([3, 7, 14, 30].includes(newStreak)) {
        setTimeout(() => anim.triggerStreakConfetti(), 300);
      }
      if (greeting.isMystery) {
        setMysteryReward(computeSparkReward(greeting.sparkReward, streak));
        setTimeout(() => setShowGiftModal(true), 1000);
      }

      // Bookkeeping runs in the background — doesn't block the UI
      const refDoc = userProfileRef(currentUser.uid);
      Promise.all([
        runTransaction(db, async (transaction) => {
          const snap = await transaction.get(refDoc);
          const profileData = snap.exists() ? snap.data() : {};
          transaction.set(refDoc, {
            sparkBalance: Number(profileData?.sparkBalance ?? 0) + earnedSparks,
            lastGreetingAt: nowMs(),
            ...(greeting.isMystery ? { lastMysteryGiftAt: nowMs() } : {}),
          }, { merge: true });
        }),
        recordGreetingDay(),
      ]).catch((err) => console.error("Reward update failed:", err));

      // Ripple attribution — strictly best-effort, never affects sending.
      // If I recently reacted to someone's greeting and am now sending my own,
      // their kindness "rippled" to me. Credit each original sender once.
      recordRipples();

    } catch (err) {
      console.error("Send failed:", err);
      setSendError("Couldn't send — please try again.");
      setTimeout(() => setSendError(""), 4000);
      setIsSending(false);
    }
  };

  const handleShareStory = useCallback(async () => {
    if (!currentUser) return;
    try {
      const refDoc = userProfileRef(currentUser.uid);
      await runTransaction(db, async (tx) => {
        const snap = await tx.get(refDoc);
        const data = snap.exists() ? snap.data() : {};
        tx.set(refDoc, { sparkBalance: Number(data.sparkBalance ?? 0) + 5 }, { merge: true });
      });
    } catch (err) {
      console.error("Share spark award failed:", err);
    }
  }, [currentUser]);

  const handleDeleteMessage = async (messageId, sparkReward) => {
    if (!currentUser) return;
    try {
      await deleteDoc(doc(db, "publicMessages", messageId));
      if (sparkReward > 0) {
        const refDoc = userProfileRef(currentUser.uid);
        runTransaction(db, async (tx) => {
          const snap = await tx.get(refDoc);
          const data = snap.exists() ? snap.data() : {};
          tx.set(refDoc, {
            sparkBalance: Math.max(0, Number(data.sparkBalance ?? 0) - sparkReward),
          }, { merge: true });
        }).catch((err) => console.error("Spark deduct failed:", err));
      }
    } catch (err) {
      console.error("Delete failed:", err);
    }
  };

  const handleClearAllMessages = async () => {
    if (!isAdmin) return;
    setAdminClearing(true);
    setAdminClearError("");
    try {
      const snap = await getDocs(collection(db, "publicMessages"));
      const deletes = [];
      for (const msgDoc of snap.docs) {
        const rSnap = await getDocs(collection(db, "publicMessages", msgDoc.id, "reactions"));
        rSnap.forEach((rDoc) => deletes.push(deleteDoc(rDoc.ref)));
        deletes.push(deleteDoc(msgDoc.ref));
      }
      await Promise.all(deletes);
      setAdminConfirm(false);
    } catch (err) {
      console.error("Clear all messages failed:", err);
      setAdminClearError(err.code === "permission-denied"
        ? "Permission denied — update your Firestore rules to allow admin deletes."
        : `Failed: ${err.message}`);
    } finally {
      setAdminClearing(false);
    }
  };

  const handleFullReset = async () => {
    if (!isAdmin) return;
    setAdminResetting(true);
    setAdminResetError("");
    try {
      const deletes = [];

      // publicMessages + reactions + gifts
      const msgsSnap = await getDocs(collection(db, "publicMessages"));
      for (const msgDoc of msgsSnap.docs) {
        const rSnap = await getDocs(collection(db, "publicMessages", msgDoc.id, "reactions"));
        rSnap.forEach((d) => deletes.push(deleteDoc(d.ref)));
        const gSnap = await getDocs(collection(db, "publicMessages", msgDoc.id, "gifts"));
        gSnap.forEach((d) => deletes.push(deleteDoc(d.ref)));
        deletes.push(deleteDoc(msgDoc.ref));
      }

      // waves
      const wavesSnap = await getDocs(collection(db, "waves"));
      wavesSnap.forEach((d) => deletes.push(deleteDoc(d.ref)));

      // presence
      const presSnap = await getDocs(collection(db, "presence"));
      presSnap.forEach((d) => deletes.push(deleteDoc(d.ref)));

      // chatRequests
      const reqSnap = await getDocs(collection(db, "chatRequests"));
      reqSnap.forEach((d) => deletes.push(deleteDoc(d.ref)));

      // reports
      const repSnap = await getDocs(collection(db, "reports"));
      repSnap.forEach((d) => deletes.push(deleteDoc(d.ref)));

      // reactionsReceived subcollection from every user
      const usersSnap = await getDocs(collection(db, "users"));
      for (const userDoc of usersSnap.docs) {
        const rxSnap = await getDocs(collection(db, "users", userDoc.id, "reactionsReceived"));
        rxSnap.forEach((d) => deletes.push(deleteDoc(d.ref)));
      }

      await Promise.all(deletes);

      // Broadcast reset timestamp — all connected clients will see this via their
      // meta/appState listener and clear their own stale globe localStorage instantly
      await setDoc(doc(db, "meta", "appState"), { lastResetAt: Date.now() }, { merge: true });

      // Also clear this device immediately without waiting for the listener to fire
      setReactedCountries({});
      try { localStorage.removeItem("seen_reacted_v1"); } catch (_) {}

      setAdminResetConfirm(false);
    } catch (err) {
      console.error("Full reset failed:", err);
      setAdminResetError(err.code === "permission-denied"
        ? "Permission denied — check Firestore rules allow admin deletes."
        : `Failed: ${err.message}`);
    } finally {
      setAdminResetting(false);
    }
  };

  const loadAdminReports = async () => {
    if (!isAdmin) return;
    setAdminReportsLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, "reports"), where("context", "==", "private"), orderBy("timestamp", "desc"), limit(100))
      );
      const reports = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Fetch sender + reporter names
      const uids = [...new Set(reports.flatMap((r) => [r.senderUid, r.reporterUid].filter(Boolean)))];
      const profiles = {};
      await Promise.all(uids.map(async (uid) => {
        const s = await getDoc(doc(db, "users", uid)).catch(() => null);
        if (s?.exists()) profiles[uid] = s.data();
      }));
      setAdminReports(reports.map((r) => ({
        ...r,
        senderName: profiles[r.senderUid]?.fullName ?? "Unknown",
        reporterName: profiles[r.reporterUid]?.fullName ?? "Unknown",
      })));
    } catch (err) {
      console.error("Failed to load reports:", err);
    } finally {
      setAdminReportsLoading(false);
    }
  };

  const handleAdminDeleteMessage = async (report) => {
    if (!isAdmin) return;
    try {
      await deleteDoc(doc(db, "privateChats", report.chatId, "messages", report.messageId));
      await updateDoc(doc(db, "reports", report.id), { resolved: true, resolvedAt: Date.now() });
      setAdminReports((prev) => prev.map((r) => r.id === report.id ? { ...r, resolved: true } : r));
    } catch (err) { console.error("Delete message failed:", err); }
  };

  const handleAdminDismissReport = async (report) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, "reports", report.id), { resolved: true });
      setAdminReports((prev) => prev.map((r) => r.id === report.id ? { ...r, resolved: true } : r));
    } catch (err) { console.error("Dismiss report failed:", err); }
  };

  // Hold the loader until the profile read positively resolves, so an already-onboarded
  // user is never shown the onboarding screen during a transient cold-start read error.
  if (isAuthLoading || (isRealSignedInUser && !profileChecked)) {
    return (
      <div className="grid h-screen place-items-center bg-slate-50">
        {profileLoadError ? (
          <div className="flex flex-col items-center gap-3 px-6 text-center">
            <p className="text-sm text-slate-600">Having trouble loading your profile.</p>
            <button onClick={() => window.location.reload()}
              className="rounded-full bg-teal-600 px-5 py-2 text-sm font-semibold text-white">
              Reload
            </button>
          </div>
        ) : (
          <Loader2 className="animate-spin text-teal-600" />
        )}
      </div>
    );
  }

  if (!isRealSignedInUser) {
    if (unauthScreen === "intro") {
      return <IntroStep onDone={() => setUnauthScreen("welcome")} />;
    }
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-2 sm:p-6">
        <div className="relative flex h-[100dvh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-white/80 bg-white/95 shadow-2xl backdrop-blur sm:h-[90vh]">
          {unauthScreen === "welcome"
            ? <WelcomeStep onStartJourney={() => setUnauthScreen("signin")} db={db} auth={auth} />
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
        <div className="fixed inset-0 z-[200]">
          <MapTransitionWrapper visible={showMap}>
            <WorldMap db={db} currentUser={currentUser} profile={profile} onClose={() => setShowMap(false)} onSendKindness={() => setShowMap(false)} lastSendTime={lastSendTime} reactedCountries={reactedCountries} hasSent={hasSent} hometownPingTime={hometownPingTime} newRippleCountry={newRippleCountry} />
          </MapTransitionWrapper>
        </div>
      )}

      <div {...(darkMode ? { "data-dark-shell": "" } : {})} className="relative flex h-[100dvh] w-full max-w-md flex-col overflow-hidden rounded-3xl sm:h-[90vh]" style={darkMode ? {} : { background: "#fff", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>

        <MysteryGiftModal open={showGiftModal} reward={mysteryReward} onClose={() => setShowGiftModal(false)} />

        {showProfileCard && (
          <ProfileCard profile={profile} streak={streak} sparkBalance={sparkBalance} onClose={() => setShowProfileCard(false)} db={db} currentUser={currentUser} />
        )}


        {showSupport && <SupportPanel onClose={() => setShowSupport(false)} />}

        {showWelcomeMoment && (
          <div className="fixed inset-0 z-[300] flex flex-col items-center justify-center bg-gradient-to-br from-teal-600 to-emerald-500 px-8 text-center"
            onClick={() => setShowWelcomeMoment(false)}>
            <div className="mb-6 text-6xl animate-bounce" style={{ animationDuration: "2s" }}>🌍</div>
            <p className="text-white text-xl font-bold leading-snug tracking-tight max-w-xs">
              You just joined a global community that believes one kind message can change someone's day.
            </p>
            <p className="mt-4 text-white/80 text-base font-medium">Start with a greeting.</p>
            <button
              onClick={() => setShowWelcomeMoment(false)}
              className="mt-10 rounded-full bg-white px-8 py-3 text-sm font-bold text-teal-700 shadow-lg active:scale-95 transition-transform">
              Let's go ✨
            </button>
          </div>
        )}


        {showChatInbox && !activeChat && (
          <PrivateChatInbox
            db={db} currentUser={currentUser} profile={profile}
            onOpenChat={(chatId, otherUid, otherName) => {
              setActiveChat({ chatId, otherUid, otherName });
            }}
            onClose={() => setShowChatInbox(false)}
          />
        )}

        {activeChat && (
          <PrivateChatWindow
            db={db} currentUser={currentUser}
            chatId={activeChat.chatId}
            otherUid={activeChat.otherUid}
            otherName={activeChat.otherName}
            onBack={() => setActiveChat(null)}
          />
        )}

        {!hasCompletedOnboarding || !profile ? (
          knownOnboarded ? (
            // This device has already completed onboarding for this user; the profile is
            // just still syncing. Never show the onboarding form here — show a recoverable
            // loader instead so an existing user is never asked to re-onboard.
            <div className="grid flex-1 place-items-center bg-slate-50">
              {profileLoadError ? (
                <div className="flex flex-col items-center gap-3 px-6 text-center">
                  <p className="text-sm text-slate-600">Having trouble loading your profile.</p>
                  <button onClick={() => window.location.reload()}
                    className="rounded-full bg-teal-600 px-5 py-2 text-sm font-semibold text-white">Reload</button>
                </div>
              ) : (
                <Loader2 className="animate-spin text-teal-600" />
              )}
            </div>
          ) : (
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
              ) : (
                <Onboarding onContinue={async (data) => { setOnboardingError(""); await completeOnboarding(data); }}
                  loading={isSavingProfile} initialData={pendingProfileData}
                  initialEmail={currentUser?.email || ""} errorMessage={onboardingError} />
              )}
            </>
          )
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
                  </div>
                  <LiveGreeterCount db={db} currentUser={currentUser} compact />
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <span className={`text-slate-300 text-xs mr-1 transition-transform duration-200 ${headerOpen ? "rotate-180" : ""}`}>▾</span>
                  <div onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setDarkMode(v => !v)}
                      className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 active:scale-90 transition-all"
                      aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}>
                      {darkMode ? <Sun size={15} /> : <Moon size={15} />}
                    </button>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setShowChatInbox(true)}
                      className="relative rounded-full p-1.5 hover:bg-slate-100 transition-colors"
                      title="Private chats">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                      </svg>
                      {chatBadgeCount > 0 && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-violet-500 px-0.5 text-[8px] font-bold text-white">
                          {chatBadgeCount > 9 ? "9+" : chatBadgeCount}
                        </span>
                      )}
                    </button>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <NotificationBell streak={streak} db={db} currentUser={currentUser} />
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <MeatballMenu
                      onWorld={() => setShowMap(true)}
                      onImpact={() => setActiveTab("impact")}
                      onShare={() => setShowProfileCard(true)}
                      onUpgrade={() => setShowUpgrade(true)}
                      onSupport={() => setShowSupport(true)}
                      onManageSubscription={async () => {
                        const cid = profile?.stripeCustomerId;
                        if (!cid) { alert("No subscription found."); return; }
                        try {
                          const res = await fetch("/api/create-portal-session", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ customerId: cid }),
                          });
                          const data = await res.json();
                          if (data.url) window.location.href = data.url;
                          else throw new Error(data.error || "Unknown error");
                        } catch (err) {
                          alert("Could not open subscription portal. Please try again.");
                        }
                      }}
                      onSignOut={handleSignOut}
                      isSigningOut={isSigningOut}
                      globePulse={anim.globePulse}
                      db={db}
                      currentUser={currentUser}
                      profile={profile}
                      isPremium={isPremium}
                      streak={streak}
                      sparkBalance={sparkBalance}
                    />
                  </div>
                </div>
              </div>

              <div
                className="overflow-hidden transition-all duration-300 ease-in-out"
                style={{ maxHeight: headerOpen ? "480px" : "0px", opacity: headerOpen ? 1 : 0 }}>
                <div className="px-4 pb-3 space-y-2 border-t border-slate-100 pt-2">
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
                    <SparkRing value={displayedSparks} max={nextLevel?.min ?? sparkBalance} percent={animatedProgress} initial={firstName?.[0]?.toUpperCase() ?? "✨"} />
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
                  </div>
                  <MoodSelector db={db} uid={currentUser.uid} currentMood={profile?.moodTag} />
                  <div className="space-y-1">
                    <NotificationPermissionBanner onPermissionChange={() => setNotifPermission(Notification.permission)} />
                    {!isChatLive && chatError && (
                      <p className="rounded-xl border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                        Chat offline ({chatError}).
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </header>

            <CircleInviteBanner db={db} currentUser={currentUser} />

            {showInstallBanner && deferredInstallRef.current && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 14px", background: "rgba(13,148,136,0.1)",
                borderBottom: "1px solid rgba(13,148,136,0.15)", flexShrink: 0,
              }}>
                <span style={{ fontSize: 13, color: darkMode ? "rgba(255,255,255,0.8)" : "#0f172a" }}>
                  Install Seen for the best experience
                </span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button onClick={handleInstall} style={{
                    fontSize: 12, fontWeight: 600, color: "#0d9488",
                    background: "none", border: "none", cursor: "pointer", padding: "2px 0",
                  }}>Install</button>
                  <button onClick={dismissInstallBanner} style={{
                    fontSize: 16, color: darkMode ? "rgba(255,255,255,0.4)" : "#94a3b8",
                    background: "none", border: "none", cursor: "pointer", lineHeight: 1, padding: 0,
                  }}>×</button>
                </div>
              </div>
            )}

            {/* Tab bar */}
            <div className="flex border-b border-slate-100 bg-white flex-shrink-0">
              <button
                onClick={() => setActiveTab("feed")}
                className={`flex-1 py-2.5 text-[12px] font-semibold transition-colors border-b-2 ${
                  activeTab === "feed"
                    ? "border-teal-500 text-teal-600"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}>
                💬 Feed
              </button>
              <button
                onClick={() => setActiveTab("hacks")}
                className={`flex-1 py-2.5 text-[12px] font-semibold transition-colors border-b-2 ${
                  activeTab === "hacks"
                    ? "border-teal-500 text-teal-600"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}>
                💡 Life Hacks
              </button>
              <button
                onClick={() => setActiveTab("support")}
                className={`flex-1 py-2.5 text-[12px] font-semibold transition-colors border-b-2 ${
                  activeTab === "support"
                    ? "border-teal-500 text-teal-600"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}>
                💚 Support
              </button>
              <button
                onClick={() => setActiveTab("impact")}
                className={`flex-1 py-2.5 text-[12px] font-semibold transition-colors border-b-2 ${
                  activeTab === "impact"
                    ? "border-teal-500 text-teal-600"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}>
                🌍 Impact
              </button>
            </div>

            {activeTab === "hacks" ? (
              <LifeHacks db={db} currentUser={currentUser} />
            ) : activeTab === "support" ? (
              <Support country={profile?.country} />
            ) : activeTab === "impact" ? (
              <MyImpact db={db} currentUser={currentUser} liveStats={liveImpact} streak={streak} profile={profile} darkMode={darkMode} />
            ) : (
            <main className="flex-1 overflow-y-auto bg-slate-50/60 px-4 py-5"
              onClick={() => { setActiveMessageId(null); }}>
              {/* Post-send map prompt — sticky so the auto-scroll-to-bottom can't hide it */}
              {showMapPrompt && (
                <div
                  className="sticky z-30"
                  style={{ top: "8px" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowMapPrompt(false); setShowMap(true); }}
                    className="w-full mb-4 flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left active:scale-[0.98] transition-all"
                    style={{ background: "linear-gradient(135deg, #0e1e30, #162d45)", border: "1px solid rgba(90,170,255,0.35)", boxShadow: "0 8px 24px rgba(0,0,0,0.25)", animation: "hackOverlayIn 0.4s ease" }}
                  >
                    <span className="text-2xl">🌍</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm" style={{ color: "#90d0ff" }}>Your kindness is traveling the world</p>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(144,208,255,0.65)" }}>Tap to watch it reach every country on the map →</p>
                    </div>
                    <span
                      onClick={(e) => { e.stopPropagation(); setShowMapPrompt(false); }}
                      className="p-1 flex-shrink-0"
                      style={{ color: "rgba(144,208,255,0.5)" }}
                    >✕</span>
                  </button>
                </div>
              )}
              {/* Reaction-from-country toast */}
              {reactionToast && (
                <div className="sticky z-30" style={{ top: "8px" }} onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setReactionToast(null); setShowMap(true); }}
                    className="w-full mb-4 flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left active:scale-[0.98] transition-all"
                    style={{ background: "linear-gradient(135deg, #3a2a05, #5a3d0a)", border: "1px solid rgba(255,179,71,0.45)", boxShadow: "0 8px 24px rgba(0,0,0,0.25)", animation: "hackOverlayIn 0.4s ease" }}
                  >
                    <span className="text-2xl">{reactionToast.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm" style={{ color: "#ffce80" }}>
                        You got a {REACTION_WORD[reactionToast.emoji] || "reaction"} from {reactionToast.country}!
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(255,206,128,0.7)" }}>Your kindness was felt — see it light up the map →</p>
                    </div>
                    <span
                      onClick={(e) => { e.stopPropagation(); setReactionToast(null); }}
                      className="p-1 flex-shrink-0"
                      style={{ color: "rgba(255,206,128,0.5)" }}
                    >✕</span>
                  </button>
                </div>
              )}
              {/* Hometown reaction toast — same-country validation (warm green) */}
              {hometownToast && (
                <div className="sticky z-30" style={{ top: "8px" }} onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setHometownToast(null); setShowMap(true); }}
                    className="w-full mb-4 flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left active:scale-[0.98] transition-all"
                    style={{ background: "linear-gradient(135deg, #0a2e1a, #133d24)", border: "1px solid rgba(80,200,120,0.5)", boxShadow: "0 8px 24px rgba(0,0,0,0.25)", animation: "hackOverlayIn 0.4s ease" }}
                  >
                    <span className="text-2xl">🏠</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm" style={{ color: "#80e8a0" }}>
                        A neighbour just {REACTION_WORD[hometownToast.emoji] ? `sent you a ${REACTION_WORD[hometownToast.emoji]}` : "reacted"}!
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(128,232,160,0.7)" }}>
                        Someone from your own country felt your kindness {hometownToast.emoji}
                      </p>
                    </div>
                    <span
                      onClick={(e) => { e.stopPropagation(); setHometownToast(null); }}
                      className="p-1 flex-shrink-0"
                      style={{ color: "rgba(128,232,160,0.5)" }}
                    >✕</span>
                  </button>
                </div>
              )}
              {/* Mood-triggered support banner */}
              {["struggling", "lonely", "tired"].includes(profile?.moodTag) && (
                <button
                  onClick={(e) => { e.stopPropagation(); setActiveTab("support"); }}
                  className="w-full mb-4 flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left active:scale-[0.98] transition-transform"
                  style={{
                    background: profile?.moodTag === "struggling"
                      ? "linear-gradient(135deg, #fce7f3, #fbcfe8)"
                      : profile?.moodTag === "lonely"
                      ? "linear-gradient(135deg, #ede9fe, #ddd6fe)"
                      : "linear-gradient(135deg, #dbeafe, #bfdbfe)",
                    border: "1px solid",
                    borderColor: profile?.moodTag === "struggling" ? "#f9a8d4"
                      : profile?.moodTag === "lonely" ? "#c4b5fd" : "#93c5fd",
                  }}
                >
                  <span className="text-2xl">
                    {profile?.moodTag === "struggling" ? "🌧️" : profile?.moodTag === "lonely" ? "🫂" : "😴"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 text-sm">
                      {profile?.moodTag === "struggling"
                        ? "You said you're struggling — you're not alone"
                        : profile?.moodTag === "lonely"
                        ? "Feeling lonely? We have support for you"
                        : "Feeling tired? Check out our wellbeing tools"}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">Tap for a free check-in &amp; resources →</p>
                  </div>
                </button>
              )}
              {(() => {
                const grouped = [];
                messages.forEach((m) => {
                  const last = grouped[grouped.length - 1];
                  if (last && last.uid === m.uid) { last.items.push(m); }
                  else { grouped.push({ uid: m.uid, sender: m.sender, moodTag: m.uid === currentUser.uid ? (profile?.moodTag ?? m.moodTag) : m.moodTag, items: [m] }); }
                });
                return grouped.map((group) => {
                  const mine = group.uid === currentUser.uid;
                  const isMulti = group.items.length > 1;
                  const firstId = group.items[0].id;
                  const isNewGroup = newMessageIds.has(firstId);
                  return (
                    <MessageSlideIn key={firstId} mine={mine} isNew={isNewGroup}>
                      <div className="mb-3">
                        <div className="w-full group">
                          <div className="flex items-center gap-1.5 px-1 mb-1.5 text-[10px] font-semibold text-slate-400">
                            <span className="flex items-center gap-1">
                              {mine ? "You" : group.sender}
                              {group.moodTag && MOOD_TAGLINES[group.moodTag] && (
                                <span className="font-light italic text-[9px] text-slate-400">· {MOOD_TAGLINES[group.moodTag]}</span>
                              )}
                            </span>
                            {(() => {
                              const country = group.items[0].country ?? (mine ? profile?.country : null);
                              if (!country) return null;
                              const flag = FLAG_MAP[country];
                              return (
                                <span className="font-normal text-slate-400">
                                  · {flag ? `${flag} ` : ''}{country}
                                </span>
                              );
                            })()}
                            {group.moodTag && <MoodPill mood={group.moodTag} tiny />}
                          </div>
                          <div className="relative">
                            <div className="space-y-0.5">
                              {group.items.map((m, idx) => {
                                const isFirst = idx === 0;
                                const isLast = idx === group.items.length - 1;
                                const isMystery = Boolean(m.isMystery);
                                const topRadius = isFirst ? "rounded-t-2xl" : "rounded-t-lg";
                                const botRadius = isLast ? "rounded-b-2xl" : "rounded-b-lg";
                                const tailClass = "";
                                const isActive = activeMessageId === m.id;
                                return (
                                  <div key={m.id} className="relative pb-2">
                                    {/* WhatsApp-style reaction bar — floats above bubble on long press */}
                                    {reactionBarId === m.id && (
                                      <>
                                        <div className="seen-qrb-backdrop" onClick={(e) => { e.stopPropagation(); setReactionBarId(null); }} />
                                        <div className={`absolute z-30 ${mine ? "right-0" : "left-0"}`}
                                          style={{ bottom: "calc(100% + 8px)" }}>
                                          <QuickReactBar
                                            db={db} messageId={m.id} senderUid={m.uid} senderName={group.sender}
                                            currentUser={currentUser} profile={profile} mine={mine} isPremium={isPremium}
                                            onClose={() => setReactionBarId(null)}
                                            onWave={() => { triggerReactionBurst("👋"); anim.triggerWaveRipple(15, 70); haptic([6]); }}
                                            onGift={(emoji) => { triggerReactionBurst(emoji); haptic([6, 20, 6]); }}
                                            onReact={(emoji) => {
                                              triggerReactionBurst(emoji);
                                              haptic([5]);
                                              if (emoji === "❤️" && !mine) setLocalHeartedMessageIds(prev => new Set([...prev, m.id]));
                                            }}
                                            onUpgrade={() => setShowUpgrade(true)}
                                            onDelete={() => { handleDeleteMessage(m.id, m.sparkReward ?? 0); setReactionBarId(null); }}
                                          />
                                        </div>
                                      </>
                                    )}

                                    {/* Bubble — tap for timestamp, long-press for reaction bar */}
                                    <div
                                      className="relative select-none"
                                      onContextMenu={(e) => e.preventDefault()}
                                      onMouseDown={() => {
                                        longPressTriggered.current = false;
                                        longPressTimer.current = setTimeout(() => {
                                          longPressTriggered.current = true;
                                          setReactionBarId(m.id);
                                          setActiveMessageId(null);
                                          haptic([6, 30, 6]);
                                        }, 450);
                                      }}
                                      onMouseUp={() => clearTimeout(longPressTimer.current)}
                                      onMouseLeave={() => { clearTimeout(longPressTimer.current); longPressTriggered.current = false; }}
                                      onTouchStart={(e) => {
                                        const touch = e.touches[0];
                                        longPressTimer.current = setTimeout(() => {
                                          setReactionBarId(m.id);
                                          setActiveMessageId(null);
                                          haptic([6, 30, 6]);
                                        }, 450);
                                      }}
                                      onTouchEnd={() => clearTimeout(longPressTimer.current)}
                                      onTouchMove={() => clearTimeout(longPressTimer.current)}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (longPressTriggered.current) { longPressTriggered.current = false; return; }
                                        if (reactionBarId === m.id) { setReactionBarId(null); return; }
                                        // Mystery tap: first tap unwraps, subsequent taps toggle timestamp
                                        if (isMystery && !mine && !unwrappedMysteries[m.id]) {
                                          handleUnwrapMystery(m.id); return;
                                        }
                                        setActiveMessageId(isActive ? null : m.id);
                                      }}>
                                      <div className="relative">
                                        {(() => {
                                          const isUnwrapped = isMystery && !mine && !!unwrappedMysteries[m.id];
                                          const isBursting = burstingMystery === m.id;
                                          const moodStyle = getMoodBubbleStyle(group.moodTag, mine);
                                          const hasMood = Boolean(moodStyle);
                                          return (
                                            <div
                                              className={`border px-4 py-3.5 text-base font-semibold select-none ${topRadius} ${botRadius} ${tailClass} ${
                                                mine
                                                  ? (hasMood ? "text-white border-transparent" : "bg-teal-600 text-white border-teal-600")
                                                  : isUnwrapped
                                                  ? "bg-gradient-to-br from-emerald-50 to-teal-50 border-teal-200 text-teal-900"
                                                  : isMystery
                                                  ? "bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 text-amber-900 mystery-invite"
                                                  : (hasMood ? "border" : "bg-white border-slate-200 text-slate-800")
                                              } ${isBursting ? "mystery-burst" : ""} ${
                                                hasMood && mine ? "seen-mood-dynamic relative overflow-hidden" : hasMood ? "seen-heartbeat" : ""
                                              }`}
                                              style={
                                                hasMood && !isUnwrapped && !(isMystery && !mine)
                                                  ? moodStyle
                                                  : isUnwrapped
                                                  ? { boxShadow: "0 0 0 1px rgba(20,184,166,0.25), 0 2px 12px rgba(20,184,166,0.12)" }
                                                  : isMystery && !mine
                                                  ? { boxShadow: "0 0 0 1px rgba(251,146,60,0.2), 0 2px 8px rgba(251,146,60,0.08)" }
                                                  : {}
                                              }>
                                              {isMystery && !mine ? (
                                                isUnwrapped ? (
                                                  <span className="mystery-reveal">{unwrappedMysteries[m.id]}</span>
                                                ) : (
                                                  <span>🎁 Tap to unwrap</span>
                                                )
                                              ) : (
                                                <>{isMystery && <span className="mr-1.5">🎁</span>}{m.text}</>
                                              )}
                                              {hasMood && mine && <span className="seen-mood-shimmer" aria-hidden="true" />}
                                            </div>
                                          );
                                        })()}
                                        <ReactionSideBadges db={db} messageId={m.id} senderUid={m.uid} currentUser={currentUser} mine={mine} onReact={triggerReactionBurst} reactorCountry={profile?.country} reactorName={profile?.fullName} localHearted={localHeartedMessageIds.has(m.id) && !mine} />
                                      </div>
                                      <StickerDisplay db={db} messageId={m.id} currentUser={currentUser} />
                                      <GiftOverlay db={db} messageId={m.id} />
                                    </div>

                                    {/* Timestamp + read receipt — hidden until tap */}
                                    {isLast && (
                                      <div className={`seen-msg-ts${isActive ? " seen-msg-ts--show" : ""} ${mine ? "text-right" : "text-left"}`}>
                                        {fmtTime(m.timestamp)}
                                        {mine && <span className="seen-receipt ml-1" />}
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
            )} {/* end activeTab === "feed" */}

            {/* FAB-style footer — only on feed tab */}
            {activeTab === "feed" && (
            <footer className="border-t border-slate-100 bg-white px-4 pt-2.5" style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}>
              {todayMessageCount >= DAILY_GREETING_LIMIT ? (
                <div className="flex items-center gap-3 rounded-2xl border border-teal-100 bg-teal-50 px-4 py-2.5">
                  <span className="text-lg">🌙</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-teal-800">You've spread {DAILY_GREETING_LIMIT} greetings today!</p>
                    <p className="text-[11px] text-teal-600">Come back tomorrow to keep the kindness going ✨</p>
                  </div>
                </div>
              ) : !pickerOpen ? (
                <>
                  {sendError && (
                    <p className="mb-2 text-center text-xs font-semibold text-red-500">{sendError}</p>
                  )}
                  <button
                    onClick={() => setPickerOpen(true)}
                    disabled={isSending}
                    className="w-full rounded-2xl py-4 text-base font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-70"
                    style={{ background: "linear-gradient(135deg, #14b8a6, #10b981)", boxShadow: "0 4px 20px rgba(20,184,166,0.4)" }}>
                    {isSending
                      ? <Loader2 size={18} className="text-white animate-spin" />
                      : <>
                          ✨ Send kindness
                          {todayMessageCount > 0 && (
                            <span className="text-sm opacity-70 font-normal">· {DAILY_GREETING_LIMIT - todayMessageCount} left</span>
                          )}
                        </>}
                  </button>
                </>
              ) : null}
              {isAdmin && (
                <div className="mt-2 flex flex-col gap-1.5">
                  <div className="flex gap-2">
                    <button
                      onClick={() => setAdminConfirm(true)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-1.5 text-[11px] font-semibold text-red-400 opacity-60 hover:opacity-100 transition-opacity"
                    >
                      <Shield size={11} />
                      Clear feed
                    </button>
                    <button
                      onClick={() => setAdminResetConfirm(true)}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-xl py-1.5 text-[11px] font-semibold text-red-600 opacity-60 hover:opacity-100 transition-opacity"
                    >
                      <Shield size={11} />
                      Full reset
                    </button>
                  </div>
                  <button
                    onClick={() => { loadAdminReports(); }}
                    className="w-full flex items-center justify-center gap-1.5 rounded-xl py-1.5 text-[11px] font-semibold text-orange-500 opacity-60 hover:opacity-100 transition-opacity"
                  >
                    <Shield size={11} />
                    Private chat reports
                  </button>
                </div>
              )}
            </footer>
            )} {/* end activeTab === "feed" footer */}

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

            {/* ── Admin: confirm clear-feed modal ── */}
            {adminConfirm && (
              <div className="absolute inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
                <div className="w-full max-w-xs rounded-3xl bg-white p-6 shadow-2xl">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                      <Shield size={22} className="text-red-500" />
                    </div>
                    <p className="font-bold text-slate-800 text-base">Clear all messages?</p>
                    <p className="text-sm text-slate-500">This will permanently delete every message and its reactions from the public feed. This cannot be undone.</p>
                    {adminClearError && (
                      <p className="text-xs font-semibold text-red-500 bg-red-50 rounded-xl px-3 py-2 w-full">{adminClearError}</p>
                    )}
                  </div>
                  <div className="mt-5 flex gap-3">
                    <button
                      onClick={() => { setAdminConfirm(false); setAdminClearError(""); }}
                      disabled={adminClearing}
                      className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleClearAllMessages}
                      disabled={adminClearing}
                      className="flex-1 rounded-2xl bg-red-500 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {adminClearing ? <><Loader2 size={14} className="animate-spin" /> Deleting…</> : "Delete all"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── Admin: private chat reports panel ── */}
            {adminReports !== null && (
              <div className="absolute inset-0 z-50 flex flex-col bg-white">
                <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 flex-shrink-0">
                  <button onClick={() => setAdminReports(null)} className="rounded-full p-1.5 hover:bg-slate-100 transition-colors">
                    <ArrowLeft size={18} className="text-slate-600" />
                  </button>
                  <h2 className="text-sm font-bold text-slate-800 flex-1">Reported Private Messages</h2>
                  <button onClick={() => setShowResolvedReports((v) => !v)}
                    className="text-[11px] text-slate-400 hover:text-slate-600 transition-colors">
                    {showResolvedReports ? "Hide resolved" : "Show resolved"}
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {adminReportsLoading && (
                    <div className="flex justify-center pt-10"><Loader2 size={22} className="animate-spin text-slate-300" /></div>
                  )}
                  {!adminReportsLoading && adminReports.filter((r) => showResolvedReports || !r.resolved).length === 0 && (
                    <div className="flex flex-col items-center justify-center pt-20 gap-2 text-center">
                      <Shield size={36} className="text-slate-200" />
                      <p className="text-sm text-slate-400">No open reports</p>
                    </div>
                  )}
                  {adminReports.filter((r) => showResolvedReports || !r.resolved).map((report) => (
                    <div key={report.id} className={`rounded-2xl border px-4 py-3 space-y-2 ${report.resolved ? "border-slate-100 bg-slate-50 opacity-60" : "border-orange-100 bg-orange-50"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${report.resolved ? "bg-slate-200 text-slate-500" : "bg-orange-200 text-orange-700"}`}>
                          {report.resolved ? "Resolved" : report.reason}
                        </span>
                        <span className="text-[10px] text-slate-400">{new Date(report.timestamp).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <p className="text-xs text-slate-800 bg-white rounded-xl px-3 py-2 border border-slate-100 leading-relaxed">"{report.messageText}"</p>
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>Sent by: <strong>{report.senderName}</strong></span>
                        <span>Reported by: <strong>{report.reporterName}</strong></span>
                      </div>
                      {!report.resolved && (
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => handleAdminDeleteMessage(report)}
                            className="flex-1 rounded-xl bg-red-500 py-2 text-xs font-bold text-white hover:bg-red-600 transition-colors">
                            Delete message
                          </button>
                          <button onClick={() => handleAdminDismissReport(report)}
                            className="flex-1 rounded-xl border border-slate-200 py-2 text-xs text-slate-600 hover:bg-slate-100 transition-colors">
                            Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Admin: confirm full-reset modal ── */}
            {adminResetConfirm && (
              <div className="absolute inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
                <div className="w-full max-w-xs rounded-3xl bg-white p-6 shadow-2xl">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                      <Shield size={22} className="text-red-600" />
                    </div>
                    <p className="font-bold text-slate-800 text-base">Full app reset?</p>
                    <p className="text-sm text-slate-500">Permanently deletes all messages, reactions, waves, presence, chat requests, and reports. User accounts and circles are kept. This cannot be undone.</p>
                    {adminResetError && (
                      <p className="text-xs font-semibold text-red-500 bg-red-50 rounded-xl px-3 py-2 w-full">{adminResetError}</p>
                    )}
                  </div>
                  <div className="mt-5 flex gap-3">
                    <button
                      onClick={() => { setAdminResetConfirm(false); setAdminResetError(""); }}
                      disabled={adminResetting}
                      className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleFullReset}
                      disabled={adminResetting}
                      className="flex-1 rounded-2xl bg-red-600 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90 active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                      {adminResetting ? <><Loader2 size={14} className="animate-spin" /> Resetting…</> : "Full reset"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
