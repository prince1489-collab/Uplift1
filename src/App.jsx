// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.

import React, { useCallback, useEffect, useMemo, useRef, useState, Suspense } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight, ArrowLeft, Bell, Calendar, ChevronDown, ChevronRight, CreditCard, Globe, Heart,
  Loader2, Mail, LogOut, Moon, Send, Sparkles, Gift, Sun, User, UserPlus, Users, Share2, Shield, X, Info, Volume2, VolumeX,
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
import { StickerDisplay } from "./StickerReactions";
import { isSoundOn, setSoundOn, playSend, playHeart, playLevelUp, playStreak, playFirstSend, startMapAmbient, stopMapAmbient } from "./sounds";
import { useBackLayer } from "./backStack";
import HaveYouTried from "./HaveYouTried";
import KindnessTreePanel from "./KindnessTree";
import MySeenStory from "./MySeenStory";
import { awardPoints } from "./points";
import { ensurePublicProfile, syncPublicProfile, readPublicProfile } from "./publicProfile";
import { pickInvitation, snoozeInvitation } from "./invitations";
import { WorldwideBoard, PostComposer, LocalPostCard, PrivateReplySheet, KindMomentCard, FocusedFeedEmpty, FocusedFeedHeader, FollowingPanel, MessageReactionsPanel, SharedJournalCard, FeaturedStoryReader, loadLocalPosts, useFollows, followUser, unfollowUser, setFollowLabelRemote, splitKindMoments, useKindMoments, loadLocalStories, splitStories, purgeDemoContent } from "./Feed2";
const Support   = React.lazy(() => import("./Support"));
const KindnessBoard = React.lazy(() => import("./KindnessBoard"));

import {
  useStreak, computeSparkReward, computeDropsGain,
  StreakBadge, StreakFreezeButton,
  SparkGiftButton,
  LiveGreeterCount, MessageReactions,
  ProfileCard,
  WaveBackButton, ReactionSideBadges,
  GiftOverlay,
  MoodPill,
  PremiumUpgradePrompt,
  scheduleGreetingWindowNotification,
  NotificationPermissionBanner,
  QuickReactBar,
} from "./UpliftRetentionFeatures";

import { getGreetingsByCategory, getAccessibleGreetings, getCurrentMonthTheme, LOCAL_GREETINGS, LANGUAGE_MAP } from "./greetings";
import { getResources, getEmergency } from "./SupportData.js";
import JournalPanel from "./Journal";
import ModerationQueue from "./ModerationQueue";
import UserGlimpse from "./UserGlimpse";
import { WellbeingCheckin, WellbeingPanel, saveCheckin } from "./Wellbeing";
import {
  useChampionGreetings, useLeaderboardCandidates,
  CommunityArena,
  recordCommunitySend,
} from "./CommunityGreetings";

import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider, OAuthProvider, getAuth, initializeAuth, onAuthStateChanged, signOut,
  signInWithPopup, signInWithRedirect, signInWithCredential, getRedirectResult, sendSignInLinkToEmail,
  setPersistence, indexedDBLocalPersistence,
  isSignInWithEmailLink, signInWithEmailLink,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, updateProfile as updateAuthProfile,
  updatePassword, reauthenticateWithCredential, EmailAuthProvider,
} from "firebase/auth";

import {
  addDoc, arrayUnion, collection, deleteDoc, doc, getDocs, getFirestore,
  increment, limit, onSnapshot, orderBy, query,
  runTransaction, serverTimestamp, setDoc, updateDoc, where,
} from "firebase/firestore";

import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { Capacitor } from "@capacitor/core";
import { registerNativePush, isNativeIOS } from "./nativePush";
import { apiUrl } from "./apiBase";
import { GlimpseChips, MOST_DAYS_EXAMPLES, ANOTHER_LIFE_EXAMPLES } from "./glimpseExamples";

const firebaseConfig = {
  apiKey: "AIzaSyBSez1kAaFXKZzM97E9y4HhDiqE3tRAeLE",
  // On production (seenapp.app) serve the OAuth handler first-party so the Google sign-in screen shows
  // our own domain and the redirect session persists; previews/dev keep the default Firebase domain.
  authDomain: (typeof window !== "undefined" && window.location.hostname.endsWith("seenapp.app"))
    ? window.location.hostname
    : "uplift-6d9ea.firebaseapp.com",
  projectId: "uplift-6d9ea",
  storageBucket: "uplift-6d9ea.firebasestorage.app",
  messagingSenderId: "821891105119",
  appId: "1:821891105119:web:6245f2bc4c8c8ee96976ea",
};

const app = initializeApp(firebaseConfig);
// On native iOS (Capacitor WKWebView) initialise auth WITHOUT the web popup/redirect resolver:
// getAuth + getRedirectResult force Firebase to load a cross-origin auth iframe from authDomain, which
// can't load in the native webview and stalls auth init — so onAuthStateChanged never fires and the app
// hangs on the loading spinner. Native sign-in uses signInWithCredential, which doesn't need the resolver.
// On web keep getAuth (+ setPersistence) so the PWA/TWA popup→redirect flow still works.
const auth = isNativeIOS()
  ? initializeAuth(app, { persistence: indexedDBLocalPersistence })
  : getAuth(app);
// Keep the session in IndexedDB — survives best in installed/standalone PWAs (TWA, home-screen),
// so a returning user is restored on launch instead of seeing the sign-in screen again.
// (initializeAuth already sets persistence natively, so only the web branch needs this.)
if (!isNativeIOS()) setPersistence(auth, indexedDBLocalPersistence).catch(() => {});
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
  "Guinea-Bissau","Guyana","Haiti","Honduras","Hong Kong","Hungary","Iceland","India","Indonesia","Iran","Iraq","Ireland","Israel",
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

// Rotating, giving-focused confirmations shown after sending — reframes the reward as the
// act of kindness itself, so a reaction-back isn't the implied payoff.
const SEND_AFFIRMATIONS = [
  "Sent",
  "Kindness sent — that's the point",
  "Someone out there will feel that",
  "On its way to someone who needs it",
  "A little more good in the world",
];

const nowMs = () => Date.now();
const normalizeEmail = (email = "") => email.trim().toLowerCase();

function fmtTime(ts) {
  if (!ts) return "";
  const ms = typeof ts === "number" ? ts : ts?.toMillis ? ts.toMillis() : Number(ts);
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDayLabel(ts) {
  if (!ts) return "";
  const ms = typeof ts === "number" ? ts : ts?.toMillis ? ts.toMillis() : Number(ts);
  const d = new Date(ms);
  const now = new Date();
  const dDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const todayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((todayDate - dDate) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "long" });
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString([], { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
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

// Mood taglines and the per-mood bubble palette lived here. Both belonged to the
// "how you're feeling" feature, retired in the V2 review pass.

function MeatballMenu({ onWorld, onShare, onFollowing, followCount = 0, onUpgrade, onManageSubscription, onSupport, onChangePassword, onKindnessTree, onSignOut, isSigningOut, globePulse, db, currentUser, profile, isPremium, streak, sparkBalance, darkMode = false, open: openProp, onOpenChange, isAdmin = false, onAdminReports, onAdminClearFeed, onAdminFullReset }) {
  const [openInternal, setOpenInternal] = useState(false);
  const open = openProp !== undefined ? openProp : openInternal;
  const setOpen = (v) => { if (onOpenChange) onOpenChange(v); else setOpenInternal(v); };
  const [showJournal, setShowJournal] = useState(false);
  const [showWellbeingHub, setShowWellbeingHub] = useState(false); // hub listing Check-in + Support
  const [showWellbeing, setShowWellbeing] = useState(false);       // the WHO-5 check-in panel
  // Android back closes these menu sub-panels instead of exiting the app (QA #2)
  useBackLayer(showJournal, () => setShowJournal(false));
  useBackLayer(showWellbeingHub, () => setShowWellbeingHub(false));
  useBackLayer(showWellbeing, () => setShowWellbeing(false));

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

  const Row = ({ onClick, icon, label, sub, danger = false, tourId }) => (
    <button
      data-tour={tourId}
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
        data-tour="menu"
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
                  tourId="m-profile"
                  onClick={() => { onShare(); close(); }}
                  icon={<IconBox><User size={16} className="text-slate-500" /></IconBox>}
                  label="Person behind the Kindness"
                  sub="Your profile · blocked accounts · password"
                />
                <Row
                  tourId="m-world"
                  onClick={() => { onWorld(); close(); }}
                  icon={<IconBox><Globe size={16} className={globePulse ? "text-teal-500" : "text-slate-500"} /></IconBox>}
                  label="World Map"
                  sub="See who's spreading kindness"
                />
                <Row
                  onClick={() => { onFollowing?.(); close(); }}
                  icon={<IconBox><Users size={16} className="text-slate-500" /></IconBox>}
                  label="People you follow"
                  sub={followCount > 0 ? `${followCount} ${followCount === 1 ? "person" : "people"} · add labels` : "Choose who's in your Focused Feed"}
                />
                <Row
                  tourId="m-wellbeing"
                  onClick={() => { setShowWellbeingHub(true); close(); }}
                  icon={<IconBox className="bg-teal-50"><span style={{ fontSize: "15px", lineHeight: 1 }}>💚</span></IconBox>}
                  label="Wellbeing"
                  sub="Wellbeing check-in & Support"
                />

              </div>

              {/* Admin tools — only for the admin account */}
              {isAdmin && (
                <>
                  <div className="mx-4 border-t border-slate-100" />
                  <div className="px-3 py-2 space-y-0.5">
                    <p className="px-3 pt-1 pb-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">Admin</p>
                    {/* Community greetings are now AI-moderated at submit; the weekly champion
                        rotation runs automatically via cron — no manual admin steps needed. */}
                    <Row
                      onClick={() => { onAdminReports?.(); close(); }}
                      icon={<IconBox className="bg-rose-50"><Shield size={15} className="text-rose-500" /></IconBox>}
                      label="Reported content"
                      sub="Review and action member reports"
                    />
                    <Row
                      onClick={() => { onAdminClearFeed?.(); close(); }}
                      danger
                      icon={<IconBox className="bg-red-50"><Shield size={15} className="text-red-400" /></IconBox>}
                      label="Clear feed"
                      sub="Delete all public messages"
                    />
                    <Row
                      onClick={() => { onAdminFullReset?.(); close(); }}
                      danger
                      icon={<IconBox className="bg-red-50"><Shield size={15} className="text-red-600" /></IconBox>}
                      label="Full reset"
                      sub="Wipe feed + reset everyone"
                    />
                  </div>
                </>
              )}

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

              {/* Legal + copyright */}
              <div className="px-3 pb-8 pt-1 text-center">
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
                  <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">Privacy Policy</a>
                  <span className="text-slate-200">·</span>
                  <a href="/child-safety.html" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">Child Safety</a>
                  <span className="text-slate-200">·</span>
                  <a href="/delete-account.html" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">Delete Account</a>
                </div>
                <p className="mt-2 text-[10px] text-slate-300">
                  © {new Date().getFullYear()} Mahiman Singh Rathore · All rights reserved
                  <span className="block mt-1 text-slate-200">build {__BUILD_ID__}</span>
                </p>
              </div>

            </div>
          </div>
        </div>,
        document.body
      )}
      {showJournal && (
        <JournalPanel db={db} currentUser={currentUser} darkMode={darkMode} onClose={() => setShowJournal(false)} />
      )}
      {showWellbeingHub && (
        <WellbeingHubSheet
          onCheckin={() => { setShowWellbeingHub(false); setShowWellbeing(true); }}
          onSupport={() => { setShowWellbeingHub(false); onSupport(); }}
          onClose={() => setShowWellbeingHub(false)}
        />
      )}
      {showWellbeing && (
        <WellbeingPanel db={db} currentUser={currentUser} onClose={() => setShowWellbeing(false)} onSupport={() => { setShowWellbeing(false); onSupport(); }} />
      )}
    </>
  );
}

// Wellbeing hub — two clear sub-categories: a check-in and support resources.
function WellbeingHubSheet({ onCheckin, onSupport, onClose }) {
  const HubRow = ({ emoji, label, sub, onClick }) => (
    <button onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white px-4 py-3.5 text-left hover:bg-slate-50 transition-colors">
      <span className="text-xl">{emoji}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        <span className="block text-[12px] text-slate-500">{sub}</span>
      </span>
      <ChevronRight size={18} className="text-slate-300" />
    </button>
  );
  return createPortal(
    <div data-portal className="fixed inset-0 z-[160] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative sheet-slide-up rounded-t-3xl bg-white shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-2"><div className="w-10 h-1 rounded-full bg-slate-200" /></div>
        <div className="px-5 pb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">💚 Wellbeing</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Close"><X size={20} /></button>
        </div>
        <p className="px-5 pb-3 text-[12px] text-slate-500 leading-relaxed">
          A gentle place to check in with yourself, and to find support whenever you need it.
        </p>
        <div className="px-4 pb-8 space-y-2">
          <HubRow emoji="🌤️" label="Wellbeing check-in" sub="A private WHO-5 reflection & your trend" onClick={onCheckin} />
          <HubRow emoji="🛟" label="Support" sub="Helplines and supportive resources" onClick={onSupport} />
        </div>
      </div>
    </div>,
    document.body
  );
}

// Manage the people you've blocked: lists users/{uid}/blockedUsers and lets you unblock
// (deleteDoc). Unblocking restores their content to the feed on the next snapshot.
function BlockedAccountsPanel({ db, currentUser, onClose }) {
  const [list, setList] = useState(null); // null = loading, [] = none
  useEffect(() => {
    if (!currentUser?.uid) return;
    const unsub = onSnapshot(
      collection(db, "users", currentUser.uid, "blockedUsers"),
      (snap) => setList(snap.docs.map((d) => ({ uid: d.id, ...d.data() }))
        .sort((a, b) => (b.blockedAt ?? 0) - (a.blockedAt ?? 0))),
      () => setList([])
    );
    return () => unsub();
  }, [db, currentUser?.uid]);

  const unblock = (uid) => {
    deleteDoc(doc(db, "users", currentUser.uid, "blockedUsers", uid)).catch(() => {});
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
          <h2 className="text-lg font-bold text-slate-800">Blocked accounts</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Close"><X size={20} /></button>
        </div>
        <p className="px-5 pb-3 text-xs text-slate-400">
          You won't see messages from people you block. You can unblock anyone at any time.
        </p>
        <div className="overflow-y-auto overscroll-contain px-3 pb-8">
          {list === null ? (
            <div className="py-10 text-center text-sm text-slate-400">Loading…</div>
          ) : list.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">
              <div className="text-3xl mb-2">🕊️</div>
              You haven't blocked anyone.
            </div>
          ) : (
            list.map((b) => (
              <div key={b.uid} className="flex items-center gap-3 px-3 py-2.5 rounded-2xl hover:bg-slate-50">
                <div className="h-9 w-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 text-slate-400">
                  <span style={{ fontSize: "15px" }}>🚫</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-700 truncate">{b.name || "Someone"}</p>
                  <p className="text-[11px] text-slate-400">Blocked</p>
                </div>
                <button
                  onClick={() => unblock(b.uid)}
                  className="text-xs font-semibold text-teal-600 hover:text-teal-700 px-3 py-1.5 rounded-full hover:bg-teal-50">
                  Unblock
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// Change the password of an email/password account (re-auth + updatePassword).
// Google/Apple sign-in users are pointed to their provider instead.
function ChangePasswordPanel({ currentUser, onChangePassword, onClose }) {
  const providers = currentUser?.providerData ?? [];
  const isPasswordAccount = providers.some((p) => p?.providerId === "password");
  const providerName = providers.some((p) => p?.providerId === "google.com")
    ? "Google"
    : providers.some((p) => p?.providerId === "apple.com") ? "Apple" : "your sign-in provider";

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setMessage("");
    if (next.length < 6) { setError("New password must be at least 6 characters."); return; }
    if (next !== confirm) { setError("New passwords don't match."); return; }
    if (next === current) { setError("New password must be different from your current one."); return; }
    setBusy(true);
    const result = await onChangePassword(current, next);
    setBusy(false);
    if (result?.error) { setError(result.error); return; }
    setMessage("Password updated ✓");
    setCurrent(""); setNext(""); setConfirm("");
    setTimeout(() => onClose?.(), 1400);
  };

  const inputCls = "w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 px-4 text-base text-slate-900 placeholder:text-slate-400";

  return createPortal(
    <div data-portal className="fixed inset-0 z-[160] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative sheet-slide-up rounded-t-3xl bg-white shadow-2xl max-h-[85dvh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-center pt-3 pb-2 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-slate-200" />
        </div>
        <div className="px-5 pb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Change password</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Close"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pb-8">
          {!isPasswordAccount ? (
            <div className="py-8 text-center">
              <div className="text-3xl mb-3">🔐</div>
              <p className="text-sm text-slate-600 leading-relaxed">
                You signed in with <span className="font-semibold text-slate-800">{providerName}</span>, so your
                password is managed there. To change it, update your {providerName} account.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3 pt-1">
              <input type="password" autoComplete="current-password" className={inputCls}
                placeholder="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} />
              <input type="password" autoComplete="new-password" className={inputCls}
                placeholder="New password (min 6 characters)" value={next} onChange={(e) => setNext(e.target.value)} />
              <input type="password" autoComplete="new-password" className={inputCls}
                placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              {error && <p className="px-1 text-sm text-rose-600">{error}</p>}
              {message && <p className="px-1 text-sm font-semibold text-teal-600">{message}</p>}
              <button type="submit" disabled={busy || !current || !next || !confirm}
                className="w-full rounded-2xl bg-teal-600 py-3.5 text-sm font-bold text-white hover:bg-teal-700 transition-colors disabled:opacity-50">
                {busy ? "Updating…" : "Update password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

// v2: the glimpse questions moved out of signup. A couple of days in, a small feed
// card invites the user to add them; this sheet collects the two lines and saves
// them to the profile (owner update — no rules change needed).
function GlimpsePromptSheet({ initial = {}, onSave, onClose }) {
  const [mostDays, setMostDays] = useState(initial.mostDays || "");
  const [anotherLife, setAnotherLife] = useState(initial.anotherLife || "");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try { await onSave({ mostDays: mostDays.trim(), anotherLife: anotherLife.trim() }); } catch { /* ignore */ }
    setBusy(false);
    onClose?.();
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
          <h2 className="text-lg font-bold text-slate-800">The person behind the kindness</h2>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Close"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 pb-8 space-y-3">
          <p className="text-xs text-slate-500 leading-relaxed">
            Two light-hearted lines others see when they tap your name. Keep it playful — no
            personal details.
          </p>
          <div>
            <label className="text-sm font-medium text-slate-600">💛 Most days, I'm…</label>
            <input value={mostDays} onChange={(e) => setMostDays(e.target.value)} maxLength={120}
              placeholder="a tired but hopeful nurse"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 px-3 text-sm text-slate-900 placeholder:text-slate-400" />
            <GlimpseChips examples={MOST_DAYS_EXAMPLES} accent="amber" onPick={setMostDays} />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-600">✨ In another life, I'd be…</label>
            <input value={anotherLife} onChange={(e) => setAnotherLife(e.target.value)} maxLength={120}
              placeholder="a jazz pianist in Lisbon"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 px-3 text-sm text-slate-900 placeholder:text-slate-400" />
            <GlimpseChips examples={ANOTHER_LIFE_EXAMPLES} accent="violet" onPick={setAnotherLife} />
          </div>
          <button onClick={save} disabled={busy || (!mostDays.trim() && !anotherLife.trim())}
            className="w-full rounded-2xl bg-teal-600 py-3.5 text-sm font-bold text-white hover:bg-teal-700 transition-colors disabled:opacity-50">
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

const REACTION_WORD = { "❤️": "heart", "🙏": "thank you", "😊": "smile", "🌟": "star" };
const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
const TOAST_AGE_LIMIT_MS = 30 * 60 * 1000; // reactions older than 30 min never pop a toast
// If a user's shared feeling reads as distressed, gently surface the Support flow to them.
const DISTRESS_RE = /(strugg|anx|depress|lonely|alone|hopeless|overwhelm|can'?t cope|exhaust|burn(t| ?ed)? out|worthless|suicid|self.?harm|breaking down|falling apart|so sad|really sad|give up|giving up|end (it|my life|the pain)|kill (myself|me)|hurt(ing)? myself|want(ing)? to die|wanna die|better off dead|don'?t want to (be here|live|wake up)|no reason to (live|go on)|take my (own )?life)/i;
const TOUR_VERSION = 4; // bump to re-run the guided tour once for everyone after a release
const ADMIN_EMAIL = "prince1489@googlemail.com";

// Compact age for a notification row — the bell had no timestamps at all, so a two-minute-old
// like and a two-week-old one looked identical.
function shortAgo(ts) {
  const t = Number(ts) || 0;
  if (!t) return "";
  const mins = Math.floor((Date.now() - t) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return days < 7 ? `${days}d` : new Date(t).toLocaleDateString([], { day: "numeric", month: "short" });
}

// ── "Since your last visit" boundary ─────────────────────────────────────────
// The bell used to list everything the queries returned, forever, so a like from three
// weeks ago sat at the top looking current. Everything is now filtered to the current
// visit. A visit starts when the app is opened after being away for VISIT_GAP_MS; a quick
// reload keeps the same boundary, so refreshing doesn't wipe notifications you hadn't read.
const VISIT_GAP_MS = 30 * 60 * 1000;   // away this long → it's a new visit
const FIRST_RUN_WINDOW_MS = 48 * 60 * 60 * 1000; // no history yet → show the last 2 days
function resolveVisitStart() {
  const now = Date.now();
  let start = 0, lastActive = 0;
  try {
    start = Number(localStorage.getItem("seen_visit_start")) || 0;
    lastActive = Number(localStorage.getItem("seen_last_active")) || 0;
  } catch { /* ignore */ }
  if (!start || !lastActive || now - lastActive > VISIT_GAP_MS) {
    // New visit: show everything that arrived since we last saw them.
    start = lastActive || now - FIRST_RUN_WINDOW_MS;
    try { localStorage.setItem("seen_visit_start", String(start)); } catch { /* ignore */ }
  }
  try { localStorage.setItem("seen_last_active", String(now)); } catch { /* ignore */ }
  return start;
}

// `nudges` are the app's own invitations — "check in on your wellbeing", "follow someone",
// "see the Kindness globe" — chosen and paced by src/invitations.js, which guarantees at most
// one at a time. They differ from every other row here in three ways:
//   - device-local and computed, not Firestore events;
//   - NOT filtered by the since-your-last-visit boundary, because an invitation is a standing
//     offer rather than something that happened, and expiring it after one visit would mean
//     nobody ever read it;
//   - they never raise the unread count (see `totalUnread` below).
// This is the app's single channel for talking to the user. Anything that would otherwise be a
// banner interrupting the feed belongs here instead.
function NotificationBell({ streak, db, currentUser, hasSentGreeting, nudges = [] }) {
  const [open, setOpen] = useState(false);
  // Resolved once per mount — the boundary must not move under the user mid-session.
  const [visitStart] = useState(resolveVisitStart);
  // Keep the "last active" stamp fresh while the tab is open, so a long session that is
  // later reloaded is treated as continuous rather than as a fresh visit.
  useEffect(() => {
    const touch = () => { try { localStorage.setItem("seen_last_active", String(Date.now())); } catch { /* ignore */ } };
    const id = setInterval(touch, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", touch);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", touch); };
  }, []);
  const [waves, setWaves] = useState([]);
  const [likes, setLikes] = useState([]);
  const [dismissedLikes, setDismissedLikes] = useState(new Set());
  const [likesSeenAt, setLikesSeenAt] = useState(() => {
    try { return Number(localStorage.getItem("seen-likes-at")) || 0; } catch { return 0; }
  });
  const [rippleRows, setRippleRows] = useState([]);
  const [ripplesSeenAt, setRipplesSeenAt] = useState(() => {
    try { return Number(localStorage.getItem("seen-ripples-at")) || 0; } catch { return 0; }
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
            new Notification("Someone waved at you 👋", { body: "Open Seen to wave back", icon: "/icon-192.png", badge: "/badge-96.png" });
          }
        });
      }
      prevWaveIdsRef.current = new Set(newWaves.map((w) => w.id));
      setWaves(newWaves);
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
              const us = await readPublicProfile(db, r.reactorUid);
              name = (us?.fullName || "").trim().split(" ")[0] || "Someone";
              if (!country) country = us?.country || "";
              likeNameCacheRef.current[r.reactorUid] = name;
            } catch { name = "Someone"; }
          }
        }
        return { id: r.id, name: name || "Someone", country, at: typeof r.reactedAt === "number" ? r.reactedAt : 0 };
      }));
      if (notifyReadyRef.current && typeof Notification !== "undefined" && Notification.permission === "granted") {
        resolved.forEach((l) => {
          if (!prevLikeIdsRef.current.has(l.id) && l.at > likesSeenAtRef.current) {
            new Notification(`${l.name}${l.country ? ` from ${l.country}` : ""} liked your message ❤️`, { icon: "/icon-192.png", badge: "/badge-96.png" });
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

  // Kindness chains — people this user reached who went on to greet someone else.
  useEffect(() => {
    if (!db || !currentUser) return;
    const q = query(collection(db, "users", currentUser.uid, "ripples"), orderBy("createdAt", "desc"), limit(5));
    return onSnapshot(q, (snap) => {
      setRippleRows(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }, () => {});
  }, [db, currentUser]);

  // Mark ripples as seen once the panel is opened → clears their part of the badge.
  useEffect(() => {
    if (!open || rippleRows.length === 0) return;
    const newest = rippleRows.reduce((m, r) => Math.max(m, r.createdAt ?? 0), ripplesSeenAt);
    setRipplesSeenAt(newest);
    try { localStorage.setItem("seen-ripples-at", String(newest)); } catch (_) {}
  }, [open, rippleRows]);

  // The feelingReplies and kindnessEchoes listeners lived here. Both belonged to the
  // "how you're feeling" kindness loop, retired in the V2 review pass.

  const dismissWave = async (id) => {
    if (!db) return;
    await setDoc(doc(db, "waves", id), { read: true }, { merge: true }).catch(() => {});
  };
  const dismissAllWaves = () => waves.forEach((w) => dismissWave(w.id));
  const dismissLike = (id) => setDismissedLikes((s) => new Set(s).add(id));

  // Everything shown is scoped to this visit — anything older is history, not a notification.
  const sinceVisit = (ts) => (Number(ts) || 0) > visitStart;
  const visibleWaves = waves.filter((w) => sinceVisit(w.createdAt));
  const visibleLikes = likes.filter((l) => !dismissedLikes.has(l.id) && sinceVisit(l.at));
  const visibleRipples = rippleRows.filter((r) => sinceVisit(r.createdAt));

  // The badge counts what's in the list and not yet looked at — so it can never exceed
  // the number of rows the user will actually see.
  const newLikesCount = visibleLikes.filter((l) => l.at > likesSeenAt).length;
  const newRipplesCount = visibleRipples.filter((r) => (r.createdAt ?? 0) > ripplesSeenAt).length;
  // PEOPLE ONLY. Invitations deliberately do not raise this — see rule 1 in src/invitations.js.
  // A red count has to mean "a person did something", or the badge stops being believed and the
  // real notifications stop being read along with it. This previously added `nudges.length`.
  const totalUnread = visibleWaves.length + newLikesCount + newRipplesCount;
  // ...but an invitation nobody can see is not an invitation. So when there's nothing from a
  // person and something from the app, the bell gets a quiet amber dot with no number: present
  // enough to notice, distinct enough that it never reads as "someone replied to you".
  const showQuietDot = totalUnread === 0 && nudges.length > 0;

  // Everything merges into ONE list, newest first, each row stamped with its age. Grouping by
  // type meant an older ripple could sit above a fresh like, and with no timestamps at all
  // there was no way to tell a two-minute-old event from a two-week-old one.
  //
  // Ripples are one doc per responder, so several from the same country read as duplicates —
  // they collapse into a single row that says how many people, which is also more informative.
  const rows = useMemo(() => {
    const out = [];
    visibleWaves.forEach((w) => out.push({
      id: w.id, ts: Number(w.createdAt) || 0, icon: "👋", tint: "", fresh: true,
      text: <>Someone waved at you</>, onDismiss: () => dismissWave(w.id),
    }));
    visibleLikes.forEach((l) => out.push({
      id: l.id, ts: l.at, icon: "❤️", tint: "bg-rose-50/60", fresh: l.at > likesSeenAt,
      text: <><span className="font-semibold">{l.name}</span>{l.country ? <> from <span className="font-semibold">{l.country}</span></> : null} liked your message</>,
      onDismiss: () => dismissLike(l.id),
    }));
    const byCountry = new Map();
    visibleRipples.forEach((r) => {
      const key = r.responderCountry || "—";
      const prev = byCountry.get(key);
      const ts = Number(r.createdAt) || 0;
      if (prev) { prev.n += 1; prev.ts = Math.max(prev.ts, ts); }
      else byCountry.set(key, { n: 1, ts, country: r.responderCountry, id: r.id });
    });
    byCountry.forEach((g) => out.push({
      id: `ripple_${g.id}`, ts: g.ts, icon: "🌱", tint: "bg-emerald-50/60", fresh: g.ts > ripplesSeenAt,
      text: g.n > 1
        ? <><span className="font-semibold">{g.n} people</span> you reached{g.country ? <> in <span className="font-semibold">{g.country}</span></> : null} went on to greet others</>
        : <>Someone you reached{g.country ? <> in <span className="font-semibold">{g.country}</span></> : null} went on to greet others</>,
    }));
    nudges.forEach((n) => out.push({
      id: n.id, ts: n.ts, icon: n.icon, tint: "bg-amber-50/60", fresh: true,
      text: n.text, onClick: n.onClick, onDismiss: n.onDismiss,
    }));
    return out.sort((a, b) => b.ts - a.ts).slice(0, 8);
  }, [visibleWaves, visibleLikes, visibleRipples, likesSeenAt, ripplesSeenAt, nudges]);
  // Honest, transparently system-authored reassurance: if you've shared kindness but no one
  // has reacted yet, Seen itself acknowledges you (never disguised as another person). It clears
  // on its own the moment a real reaction arrives. Not counted as "unread" — no red badge.
  const showSeenAck = hasSentGreeting && visibleLikes.length === 0;
  const hot = streak >= 7;

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)}
        aria-label={totalUnread > 0
          ? `Notifications, ${totalUnread} new`
          : showQuietDot ? "Notifications, one suggestion" : "Notifications"}
        className="relative flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 active:scale-90 transition-all">
        <Bell size={18} />
        {totalUnread > 0 && (
          <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
        {showQuietDot && (
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-400 ring-2 ring-white" />
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
                {streak >= 3
                  ? `+${streak >= 30 ? 100 : streak >= 14 ? 75 : streak >= 7 ? 50 : 25}% drop bonus active`
                  : streak > 0 ? "Keep it going — 3 days unlocks a drop bonus"
                  : "Send a greeting today to begin"}
              </p>
            </div>
          </div>
          <div className="border-b border-slate-100 px-4 py-1.5">
            {/* Only claim "since your last visit" when that's actually what the list is.
                Nudges deliberately survive across visits, so with one in the list the header
                would be describing something the rows don't do. */}
            <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
              {nudges.length > 0 ? "For you" : "Since your last visit"}
            </p>
          </div>
          <div className="max-h-72 overflow-y-auto">
            {rows.length === 0 && !showSeenAck ? (
              <p className="px-4 py-6 text-center text-[11px] text-slate-400">Nothing new since you were last here</p>
            ) : (
              <div className="py-1">
                {showSeenAck && (
                  <div className="flex items-start gap-2.5 px-4 py-2.5">
                    <span className="text-base flex-shrink-0">💛</span>
                    <p className="flex-1 text-[11px] text-slate-700 min-w-0">
                      Your kindness is out there spreading — thank you for showing up.
                      <span className="mt-0.5 block text-[10px] font-semibold text-emerald-600">— from Seen</span>
                    </p>
                  </div>
                )}
                {rows.map((r) => (
                  <div key={r.id} className={`flex items-center gap-2.5 px-4 py-2.5 ${r.fresh ? r.tint : ""} hover:bg-slate-50`}>
                    <span className="text-base flex-shrink-0">{r.icon}</span>
                    {/* A row that can act is a button; one that only reports stays a paragraph,
                        so nothing looks tappable that isn't. */}
                    {r.onClick ? (
                      <button onClick={() => { setOpen(false); r.onClick(); }}
                        className="min-w-0 flex-1 text-left text-[11px] leading-snug text-slate-700">
                        {r.text}
                      </button>
                    ) : (
                      <p className="min-w-0 flex-1 text-[11px] leading-snug text-slate-700">{r.text}</p>
                    )}
                    <span className="flex-shrink-0 text-[10px] tabular-nums text-slate-400">{shortAgo(r.ts)}</span>
                    {r.onDismiss && (
                      <button onClick={r.onDismiss}
                        className="flex h-6 w-6 flex-shrink-0 items-center justify-center text-slate-300 hover:text-slate-500">
                        <X size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          {(visibleWaves.length > 1 || visibleLikes.length > 0) && (
            <div className="border-t border-slate-100 px-4 py-2">
              <button
                onClick={() => {
                  dismissAllWaves();
                  visibleLikes.forEach((l) => dismissLike(l.id));
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
  const [form, setForm] = useState({ country: "", fullName: "", email: "", dobMonth: "", dobDay: "", dobYear: "", mostDays: "", anotherLife: "" });

  useEffect(() => {
    const [dobMonth = "", dobDay = "", dobYear = ""] = (initialData?.dob || "").replace(",", "").split(" ");
    setForm((prev) => ({
      ...prev,
      country: initialData?.country || "",
      fullName: initialData?.fullName || "",
      email: initialEmail || initialData?.email || "",
      dobMonth, dobDay, dobYear,
      mostDays: initialData?.mostDays || "",
      anotherLife: initialData?.anotherLife || "",
    }));
  }, [initialData, initialEmail]);

  // Age gate — a complete date of birth is now required, and under-13s cannot create an account
  // (the app's minimum age). Computed from the DOB selectors.
  const dobComplete = Boolean(form.dobMonth && form.dobDay && form.dobYear);
  const age = (() => {
    if (!dobComplete) return null;
    const mi = MONTHS.indexOf(form.dobMonth);
    if (mi < 0) return null;
    const d = new Date(Number(form.dobYear), mi, Number(form.dobDay));
    if (Number.isNaN(d.getTime())) return null;
    const now = new Date();
    let a = now.getFullYear() - d.getFullYear();
    const md = now.getMonth() - d.getMonth();
    if (md < 0 || (md === 0 && now.getDate() < d.getDate())) a -= 1;
    return a;
  })();
  const tooYoung = age !== null && age < 13;
  // v2: the glimpse questions are no longer asked at signup — they arrive as a gentle
  // in-app prompt a couple of days in (GlimpsePromptCard).
  //
  // A name is required. It used to be optional, which meant an account could exist with no
  // name at all — and the name is what every other member sees above your messages, what the
  // header greets you by, and what search will look you up by. "Someone" everywhere is worse
  // for the person who skipped it than the one extra field.
  const nameGiven = form.fullName.trim().length > 0;
  const valid = Boolean(form.country) && nameGiven && Boolean(form.email) && dobComplete && !tooYoung;

  const onChange = (e) => { const { name, value } = e.target; setForm((prev) => ({ ...prev, [name]: value })); };

  if (loading) return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin text-teal-600" /></div>;

  return (
    <div className="seen-auth-bg h-full w-full overflow-y-auto bg-gradient-to-b from-[#FFF6EF] via-[#f7f7f6] to-[#f6f5f2] px-6 pt-8 pb-10">
      <form className="mx-auto w-full max-w-sm space-y-3"
        onSubmit={(e) => { e.preventDefault(); if (!valid) return; onContinue({ ...form, dob: (form.dobMonth && form.dobDay && form.dobYear) ? `${form.dobMonth} ${form.dobDay}, ${form.dobYear}` : "" }); }}>
        <div className="flex justify-center pb-3">
          <img src="/icon-192.png" alt="" width={68} height={68} className="rounded-[19px] shadow-md" />
        </div>
        <h1 className="seen-auth-title font-display text-center text-[42px] leading-[1.05] font-normal tracking-[-0.04em]">Welcome to Seen</h1>
        <p className="seen-auth-sub pb-4 text-center text-[20px] leading-tight">Tell us a bit about yourself to start connecting.</p>

        <InputRow icon={Globe} rightIcon={<ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />}>
          <select name="country" value={form.country} onChange={onChange}
            className={`w-full appearance-none rounded-2xl border border-slate-300 bg-slate-50 py-3.5 pr-10 pl-11 text-base ${form.country ? "text-slate-900" : "text-slate-600"}`}>
            <option value="">Select Country</option>
            {COUNTRY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </InputRow>

        <InputRow icon={User}>
          <input name="fullName" value={form.fullName} onChange={onChange} placeholder="Your name"
            autoComplete="name"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pr-3 pl-11 text-base text-slate-900 placeholder:text-slate-500" />
        </InputRow>
        {/* Only once they've started filling the form in, so the very first thing a new
            person sees isn't an error about a field they haven't reached. */}
        {!nameGiven && (form.country || form.dobMonth) && (
          <p className="px-1 -mt-1 text-xs font-semibold" style={{ color: "#B85F1D" }}>
            Add a name so people know who's saying hello.
          </p>
        )}

        {initialEmail ? (
          // Signed in via a provider: the email can't change, so show it as a quiet caption
          // instead of a greyed-out input (QA: the readOnly grey-on-grey field was hard to read).
          // Warm neutrals rather than Tailwind's slate: slate is a blue-grey, and next to the
          // sunset ramp it reads as a leftover from the old palette.
          <p className="px-1 pb-1 text-sm" style={{ color: "#7A6558" }}>
            Signed in as <span className="font-semibold" style={{ color: "#5C4A3E" }}>{form.email}</span>
          </p>
        ) : (
          <InputRow icon={Mail}>
            <input type="email" name="email" value={form.email} onChange={onChange} placeholder="Email Address"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pr-3 pl-11 text-base text-slate-900 placeholder:text-slate-500" />
          </InputRow>
        )}

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
          {tooYoung && (
            <p className="mt-2 text-xs font-semibold text-rose-600">You need to be 13 or older to use Seen.</p>
          )}
        </div>

        {/* v2: the "little about you" glimpse questions moved out of signup — they arrive
            as a gentle in-app prompt after a couple of days (GlimpsePromptSheet). */}

        <button type="submit" disabled={!valid}
          className={`mt-2 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-xl font-semibold text-white transition-colors ${valid ? "bg-teal-600 hover:bg-teal-700" : "bg-slate-400"} disabled:cursor-not-allowed`}>
          Continue <ArrowRight size={18} />
        </button>
        <p className="pt-1 text-center text-[11px] leading-relaxed" style={{ color: "#7A6558" }}>
          You must be 13 or older to use Seen. By continuing you agree to our{" "}
          <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">Privacy Policy</a>{" "}and{" "}
          <a href="/child-safety.html" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">Child Safety Standards</a>.
        </p>
      </form>
    </div>
  );
}

function GreetingPicker({ profile, streak, onSelect, onClose, onUpgrade, onPersonalShare, isSending = false, remainingToday, db, currentUser, communityGreetings = [] }) {
  const isPremium = true;
  const categories = getGreetingsByCategory(isPremium);
  const [activeCategory, setActiveCategory] = useState("core");

  // Local greetings filtered to the user's language; fall back to global phrases if no match.
  const userLang = LANGUAGE_MAP[profile?.country] ?? null;
  const localGreetings = userLang
    ? LOCAL_GREETINGS.filter((g) => g.language === userLang)
    : LOCAL_GREETINGS.filter((g) => g.language === "global");
  const hasLocalGreetings = localGreetings.length > 0;

  const isCommunity = activeCategory === "community";
  const activeGreetings = isCommunity
    ? communityGreetings
    : activeCategory === "local"
    ? localGreetings
    : categories.find((c) => c.id === activeCategory)?.greetings ?? [];
  // v2: Community category retired; replaced by a personalised free-text share option.
  const allCategories = [
    { id: "core",      label: "Greetings", emoji: "☀️", isPremium: false },
    { id: "warmth",    label: "Warmth",    emoji: "💛", isPremium: false },
    { id: "calm",      label: "Calm",      emoji: "🌿", isPremium: false },
    ...(hasLocalGreetings ? [{ id: "local", label: "Local", emoji: "🗣️", isPremium: true }] : []),
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
      <div data-tour="categories" className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
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
      {/* v2: personalised free-text share (replaces the retired Community pool) */}
      {onPersonalShare && (
        <button onClick={onPersonalShare}
          className="w-full flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-left active:scale-[0.99] transition-transform">
          <span className="text-lg">✍️</span>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-violet-800">In your own words</p>
            <p className="text-[11px] text-violet-500">Write your own kind message to share</p>
          </div>
          <span className="text-violet-400">→</span>
        </button>
      )}
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {isCommunity ? (
          <>
            <p className="text-center text-[11px] text-slate-400 leading-relaxed px-2 py-1">
              ⭐ This week's winners — voted in by the community. Vote for next week in the
              <strong className="text-teal-600"> 🌱 Community</strong> tab.
            </p>
            {activeGreetings.length === 0 ? (
              <p className="text-center text-xs text-slate-400 py-4 leading-relaxed">
                This week's winners appear here after voting.<br />Vote in the 🌱 Community tab!
              </p>
            ) : (
              activeGreetings.map((greeting) => (
                <button key={greeting.id} onClick={() => !isSending && onSelect(greeting)}
                  disabled={isSending}
                  className="seen-champion-card relative overflow-hidden w-full rounded-xl border border-amber-300 px-3 py-2.5 text-left transition-transform active:scale-[0.99] disabled:cursor-not-allowed"
                  style={{ background: "linear-gradient(135deg,#fffbeb,#fef3c7)", boxShadow: "0 1px 8px rgba(245,158,11,0.18)" }}>
                  {!isSending && (
                    <span aria-hidden className="absolute inset-0 pointer-events-none"
                      style={{ background: "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.6) 50%, transparent 65%)", animation: "seenShimmer 3.2s ease-in-out infinite" }} />
                  )}
                  <div className="relative">
                    <span className={`text-sm font-semibold ${isSending ? "text-slate-400" : "text-slate-800"}`}>{greeting.text}</span>
                    <span className="ml-2 text-xs text-teal-600">
                      +{computeDropsGain(greeting.sparkReward, streak)} drops
                      {streak >= 3 && <span className="ml-1 text-orange-500">🔥</span>}
                    </span>
                  </div>
                  <span className="relative text-[10px] text-amber-700 font-semibold">
                    {greeting.isFeatured ? "⭐ Featured · " : ""}by {greeting.authorName}{greeting.authorCountry && FLAG_MAP[greeting.authorCountry] ? ` ${FLAG_MAP[greeting.authorCountry]}` : ""}
                  </span>
                </button>
              ))
            )}
          </>
        ) : (
          activeGreetings.map((greeting) => (
            <button key={greeting.id} onClick={() => !isSending && onSelect(greeting)}
              disabled={isSending}
              className={`w-full rounded-xl border px-3 py-2.5 text-left text-sm font-semibold transition-colors ${
                isSending ? "border-slate-100 bg-slate-50 text-slate-400 cursor-not-allowed" : "border-slate-200 bg-white text-slate-800 hover:border-teal-400 hover:bg-teal-50"
              }`}>
              <span>{greeting.text}</span>
              <span className="ml-2 text-xs text-teal-600">
                +{computeDropsGain(greeting.sparkReward, streak)} drops
                {streak >= 3 && <span className="ml-1 text-orange-500">🔥</span>}
              </span>
            </button>
          ))
        )}
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
            <stop offset="100%" stopColor="#FF8580" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex items-center justify-center rounded-full"
        style={{ background: "rgba(255,255,255,0.05)" }}>
        <span style={{
          fontSize: isLetter ? "17px" : "11px",
          fontWeight: isLetter ? 700 : 700,
          color: isLetter ? "#e2e8f0" : "#A82E2C",
          lineHeight: 1,
          fontFamily: isLetter ? "Inter, sans-serif" : "inherit",
        }}>{initial}</span>
      </div>
    </div>
  );
}

let _feedCache = [];
try { _feedCache = JSON.parse(localStorage.getItem("seen_feed_cache") || "[]"); } catch {}

export default function App() {
  const [darkMode, setDarkMode] = useState(() => {
    try { const v = localStorage.getItem("seen-theme"); return v !== null ? v === "dark" : true; }
    catch { return true; }
  });
  const [soundOn, setSoundOnState] = useState(isSoundOn); // gentle UI sounds (default on)
  const toggleSound = () => { const next = !soundOn; setSoundOn(next); setSoundOnState(next); };
  useEffect(() => {
    try { localStorage.setItem("seen-theme", darkMode ? "dark" : "light"); } catch {}
  }, [darkMode]);

  // Mirror the dark shell onto <body>. Every bottom sheet in the app renders with
  // createPortal(…, document.body), which puts it OUTSIDE the app root — so none of the
  // [data-dark-shell] remaps reached them and they opened fully white. Marking body means
  // portals inherit the shell by construction, including any added later.
  useEffect(() => {
    const el = document.body;
    if (darkMode) el.setAttribute("data-dark-shell", "");
    else el.removeAttribute("data-dark-shell");
    return () => el.removeAttribute("data-dark-shell");
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
  const [tourActive, setTourActive] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState("");
  const [messages, setMessages] = useState(_feedCache);
  const [blockedUids, setBlockedUids] = useState(() => new Set()); // uids the user has blocked (feed filter)
  const [isChatLive, setIsChatLive] = useState(false);
  const [chatError, setChatError] = useState("");
  const [lastLiveAt, setLastLiveAt] = useState(null);
  const [chatRetryCount, setChatRetryCount] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sendError, setSendError] = useState("");
  const [wellbeingError, setWellbeingError] = useState("");
  // Buddy invite: detect ?add=UID in URL
  const [pendingBuddyUid] = useState(() => {
    try { return new URLSearchParams(window.location.search).get("add") || null; } catch { return null; }
  });
  // Referral: detect ?ref=UID in URL and persist to localStorage
  const [pendingReferralUid] = useState(() => {
    try { return new URLSearchParams(window.location.search).get("ref") || null; } catch { return null; }
  });
  const [isSending, setIsSending] = useState(false);
  // ── Tap-to-reveal timestamp / long-press reaction bar ──
  const [activeMessageId, setActiveMessageId] = useState(null);
  const [reactionBarId, setReactionBarId] = useState(null);
  const [reactionBarFlip, setReactionBarFlip] = useState(false); // render bar below bubble when no room above (top of feed)
  const [localHeartedMessageIds, setLocalHeartedMessageIds] = useState(new Set());
  const longPressTimer = useRef(null);
  const longPressTriggered = useRef(false);
  // Decide whether the long-press reaction bar should flip below the bubble — it normally floats
  // above, but for the newest message (top of the feed) there isn't room and it gets clipped.
  const computeReactionFlip = (el) => {
    try {
      const feedTop = feedRef.current?.getBoundingClientRect().top ?? 0;
      const bubbleTop = el?.getBoundingClientRect().top ?? 9999;
      return (bubbleTop - feedTop) < 120; // ~bar height + gap
    } catch { return false; }
  };
  // Suppress the native text-selection toolbar (Copy / Share / Select all) on message bubbles —
  // long-press should only open our reaction bar. CSS user-select:none isn't enough on some
  // Android browsers, so also cancel the selection at its source.
  useEffect(() => {
    const prevent = (e) => {
      const t = e.target;
      const el = t && t.nodeType === 3 ? t.parentElement : t; // text node → its element
      // Allow selection only inside real input fields; block it everywhere else (native-app feel).
      if (el?.closest?.("input, textarea, [contenteditable='true'], [contenteditable='']")) return;
      e.preventDefault();
    };
    document.addEventListener("selectstart", prevent);
    return () => document.removeEventListener("selectstart", prevent);
  }, []);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState("entry");
  const [showWelcomeMoment, setShowWelcomeMoment] = useState(false);
  const [pendingProfileData, setPendingProfileData] = useState(null);
  const [pendingOnboardingDetails, setPendingOnboardingDetails] = useState(null); // details awaiting wellbeing baseline step
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
  const [rippleToast, setRippleToast] = useState(null); // { id, country } — a kindness chain just grew
  const [sentToast, setSentToast] = useState(""); // brief giving-focused send confirmation (message lands at the top of the feed)
  // Kindness loop (feeling statuses)
  const [hometownPingTime, setHometownPingTime] = useState(0); // last same-country event timestamp for globe ripple
  const [newRippleCountry, setNewRippleCountry] = useState(null); // last responder's country for ripple arc on globe
  const reactObservedRef = useRef(new Set());
  const reactReadyRef = useRef(false);
  const myCountryRef = useRef(null); // kept in sync with profile.country for reaction listener closure
  const lastReachWriteRef = useRef(null); // last reactionsReceivedCount written to my profile (avoid redundant writes)
  const [unauthScreen, setUnauthScreen] = useState(
    localStorage.getItem("seen_intro_v1") ? "welcome" : "intro"
  );
  const [showProfileCard, setShowProfileCard] = useState(false);
  // Account sub-options now live under "Person behind the Kindness" (ProfileCard)
  const [showBlockedApp, setShowBlockedApp] = useState(false);
  const [showChangePasswordApp, setShowChangePasswordApp] = useState(false);
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
    if (!currentUser) return;
    // Native iOS: register for push via the Firebase Messaging Capacitor plugin (APNs→FCM token,
    // stored in the same users/{uid}.fcmToken field). Skip the web service-worker token path.
    if (isNativeIOS()) {
      registerNativePush({
        db,
        uid: currentUser.uid,
        onOpenLink: () => { try { window.location.assign("/"); } catch { /* ignore */ } },
      });
      return;
    }
    if (notifPermission !== "granted" || !messaging) return;
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) return;
    navigator.serviceWorker.ready.then((reg) => {
      getToken(messaging, { vapidKey, serviceWorkerRegistration: reg })
        .then((token) => {
          if (token) {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            setDoc(doc(db, "users", currentUser.uid), { fcmToken: token, timezone: tz }, { merge: true }).catch(() => {});
          }
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
                readPublicProfile(db, uid).then(pub => {
                  const c = pub?.country;
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
              if (Date.now() - at > TOAST_AGE_LIMIT_MS) return; // stale reaction — mark seen but skip toast
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
        else readPublicProfile(db, reactorUid)
          .then((pub) => applyCountry(pub?.country))
          .catch((e) => console.warn("[reactionsReceived] country fallback failed", e));

        // Toast once per message+user+emoji — shared dedupe with the listener above
        const toastKey = `${messageId}|${reactorUid}|${emoji}`;
        if (reactObservedRef.current.has(toastKey)) return;
        reactObservedRef.current.add(toastKey);
        if (Date.now() - at > TOAST_AGE_LIMIT_MS) return; // stale reaction — mark seen but skip toast
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
          const data = chg.doc.data() ?? {};
          const country = data.responderCountry;
          if (country && COUNTRY_COORDS[country]) setNewRippleCountry(country);
          // The best event in the app deserves more than a globe arc nobody sees —
          // pop a chain toast for FRESH ripples (stale ones surface in the story card).
          if ((data.createdAt ?? 0) > Date.now() - TOAST_AGE_LIMIT_MS) {
            setRippleToast({ id: chg.doc.id, country: country ?? null });
          }
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


  // Auto-dismiss the "💛 Sent" confirmation after ~1.6s
  useEffect(() => {
    if (!sentToast) return;
    const t = setTimeout(() => setSentToast(""), 1800);
    return () => clearTimeout(t);
  }, [sentToast]);

  // Auto-dismiss hometown toast after 7s
  useEffect(() => {
    if (!hometownToast) return;
    const t = setTimeout(() => setHometownToast(null), 7000);
    return () => clearTimeout(t);
  }, [hometownToast]);

  // Auto-dismiss kindness-chain toast after 7s
  useEffect(() => {
    if (!rippleToast) return;
    const t = setTimeout(() => setRippleToast(null), 7000);
    return () => clearTimeout(t);
  }, [rippleToast]);

  const [showMap, setShowMap] = useState(false);
  const [showLevels, setShowLevels] = useState(false); // "about kindness levels" sheet
  const [autoWaterTree, setAutoWaterTree] = useState(false); // v2: first-send routes globe→tree with a watering animation
  const [welcomeDismissed, setWelcomeDismissed] = useState(() => { try { return localStorage.getItem("seen_welcome_dismissed") === "1"; } catch { return false; } }); // transparent "Seen · official" welcome card
  const [coachSeen, setCoachSeen] = useState(() => { try { return localStorage.getItem("seen_send_coach_seen") === "1"; } catch { return false; } }); // first-time "tap to send" coach-mark
  const markCoachSeen = () => { setCoachSeen(true); try { localStorage.setItem("seen_send_coach_seen", "1"); } catch { /* ignore */ } };
  // First-time "tap to send" coach-mark: once it has shown for ~8s, mark it seen so it
  // never returns (also marked seen the moment the user opens the picker). Placed AFTER
  // coachSeen/markCoachSeen are declared to avoid a temporal-dead-zone crash on render.
  useEffect(() => {
    if (!(activeTab === "feed" && !hasSent && !coachSeen && !tourActive && !pickerOpen)) return;
    const t = setTimeout(markCoachSeen, 8000);
    return () => clearTimeout(t);
  }, [activeTab, hasSent, coachSeen, tourActive, pickerOpen]);
  const [menuOpen, setMenuOpen] = useState(false); // ⋯ menu open-state (lifted so the tour can drive it)
  const [glimpse, setGlimpse] = useState(null); // { uid, country } → tapped feed name
  // v2 Feed 2.0 (preview): free-text posts, focused-feed selection, kind moments — all device-local
  const [postComposerOpen, setPostComposerOpen] = useState(false);
  const [localPosts, setLocalPosts] = useState(() => loadLocalPosts());
  const removeLocalPost = (id) => {
    setLocalPosts((prev) => {
      const next = prev.filter((p) => p.id !== id);
      try { localStorage.setItem("seen_v2_local_posts", JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };
  // `follows` is the source of truth ({uid, name, country, label}); the feed filter and the
  // Worldwide rotator only need the uids, so those are derived.
  // Follows live in Firestore now (users/{uid}/follows), so they follow the account rather
  // than the device. localStorage is a read-through cache behind this hook, not the source.
  const follows = useFollows(db, currentUser);
  const focusedUids = useMemo(() => follows.map((f) => f.uid), [follows]);
  const [showFollowing, setShowFollowing] = useState(false);
  useBackLayer(showFollowing, () => setShowFollowing(false));
  const [reactorsFor, setReactorsFor] = useState(null); // my message whose "who felt this" is open
  useBackLayer(Boolean(reactorsFor), () => setReactorsFor(null));
  // Kind moments are real and shared now, not device-local — a private reply anywhere writes
  // one, and everyone sees it. Anonymous: the card names nobody. The uids below are used
  // only to decide which feed it belongs in, never rendered.
  const kindMoments = useKindMoments(db, currentUser, blockedUids);
  // A moment involving you or someone you follow belongs in the Focused Feed; a moment
  // between two strangers broadcasts in the Worldwide Feed.
  const { focused: focusedMoments, worldwide: worldwideMoments } = useMemo(
    () => splitKindMoments(kindMoments, focusedUids, currentUser?.uid),
    [kindMoments, focusedUids, currentUser?.uid]
  );
  const [featuredStories, setFeaturedStories] = useState(() => loadLocalStories());
  const [openStory, setOpenStory] = useState(null); // shared journal being read
  // Shared journals route the same way as kind moments: yours or a followed author's go to
  // the Focused Feed; a stranger's broadcasts in the Worldwide Feed.
  const { focused: focusedStories, worldwide: worldwideStories } = useMemo(
    // Same for shared reflections — blocking has to hold on every surface.
    () => splitStories(
      featuredStories.filter((st) => !blockedUids.has(st.authorUid)),
      focusedUids, currentUser?.uid),
    [featuredStories, blockedUids, focusedUids, currentUser?.uid]
  );
  // Shared reflections are real now: they live in Firestore so they reach other members.
  // Any device-local ones from before the switch (and the EXAMPLE seed) are merged in, so a
  // tester's existing preview cards don't vanish.
  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, "sharedReflections"), orderBy("ts", "desc"), limit(40));
    const unsub = onSnapshot(q, (snap) => {
      const remote = snap.docs.map((d) => ({ id: d.id, ...d.data(), remote: true }));
      setFeaturedStories([...remote, ...loadLocalStories()]);
    }, () => setFeaturedStories(loadLocalStories()));
    return unsub;
  }, [db]);
  useEffect(() => {
    const refresh = () => setFeaturedStories((prev) => {
      const remote = prev.filter((s2) => s2.remote);
      return [...remote, ...loadLocalStories()];
    });
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, []);
  // Sample kind moments and reflections used to be seeded here for preview testing. The app
  // is live, so they're gone — this sweeps them off devices that already have them.
  const demoPurgedRef = useRef(false);
  useEffect(() => {
    if (demoPurgedRef.current || !currentUser?.uid) return;
    demoPurgedRef.current = true;
    // Kind moments now live in Firestore, so the device-local list is only ever swept, never
    // read back into state — the returned `moments` is deliberately ignored.
    const { stories } = purgeDemoContent();
    setFeaturedStories(stories);
  }, [currentUser?.uid]);
  const [replyTarget, setReplyTarget] = useState(null); // stranger message being privately replied to
  useBackLayer(postComposerOpen, () => setPostComposerOpen(false));
  useBackLayer(Boolean(replyTarget), () => setReplyTarget(null));
  // Follow/unfollow from the Worldwide Feed. These write one Firestore document each and
  // let the follows listener update state — no local copy is kept, so every device the
  // account is signed in on converges on the same list. The name and country are
  // denormalized onto the document so "People you follow" renders without extra reads.
  const toggleFocus = (m) => {
    if (follows.some((f) => f.uid === m.uid)) unfollowUser(db, currentUser, m.uid);
    else followUser(db, currentUser, { uid: m.uid, name: m.sender || "", country: m.country ?? null });
  };
  // Follow from search. Separate from toggleFocus because that one toggles from a message
  // and this must never un-follow — the button in the results list already reads "Following"
  // and is disabled once they're in the list, so a toggle here could only ever be a misfire.
  const followProfile = ({ uid, name, country }) => followUser(db, currentUser, { uid, name, country });
  const setFollowLabel = (uid, label) => setFollowLabelRemote(db, currentUser, uid, label);
  const unfollow = (uid) => unfollowUser(db, currentUser, uid);
  // uid → label, for the chip beside a sender's name in the Focused Feed
  const followLabelByUid = useMemo(
    () => Object.fromEntries(follows.filter((f) => f.label).map((f) => [f.uid, f.label])),
    [follows]
  );
  // v2: deferred glimpse questions — sheet, invited from the 🔔 bell (see `bellNudges`)
  const [showGlimpseSheet, setShowGlimpseSheet] = useState(false);

  // ── Bell invitations ─────────────────────────────────────────────────────────
  // Everything the app wants to ask of you now comes through the bell, one at a time, paced by
  // src/invitations.js. See the rules at the top of that file — particularly that the unread
  // badge counts PEOPLE only, which is why these are passed separately from the event rows.
  //
  // Account start is stamped once so "3 days of use" has an origin for accounts that predate
  // this code and have no onboardingCompletedAt.
  const FIRST_VISIT_KEY = "seen_first_feed_visit_at";
  const [firstFeedVisitAt] = useState(() => {
    const existing = Number(safeLocalGet(FIRST_VISIT_KEY)) || 0;
    if (existing) return existing;
    const now = Date.now();
    safeLocalSet(FIRST_VISIT_KEY, String(now));
    return now;
  });
  // Bumped on dismiss/act so the memo recomputes against the updated store.
  const [invitationTick, setInvitationTick] = useState(0);

  // Remembered so the "see the Kindness globe" invitation can stop once someone has been.
  // Declared HERE, above `bellNudges`, and not next to the other `showMap` plumbing further
  // down: a `const` read by the memo's dependency array has to exist before that array is
  // built, and `useMemo(fn, [hasOpenedGlobe])` evaluates the array at the call site. Putting
  // it with its neighbours threw a temporal-dead-zone ReferenceError on every single render —
  // which the build does not catch, because it is only wrong at runtime.
  const [hasOpenedGlobe, setHasOpenedGlobe] = useState(() => safeLocalGet("seen_globe_opened") === "1");
  useEffect(() => {
    if (showMap && !hasOpenedGlobe) { setHasOpenedGlobe(true); safeLocalSet("seen_globe_opened", "1"); }
  }, [showMap, hasOpenedGlobe]);

  // v2: wellbeing check-in moved out of onboarding, now invited from the bell.
  // Also hoisted above INVITATION_COPY, which closes over the setter. That closure is only
  // called on a tap, so it would work either way — but "safe because it's deferred" is the
  // kind of reasoning that stops being true the moment someone inlines the call, so the
  // declaration just goes before its use.
  const [showWellbeingSheet, setShowWellbeingSheet] = useState(false);

  // Copy lives here rather than in invitations.js: that file decides WHEN to ask, this decides
  // what the ask says and what tapping it does.
  const INVITATION_COPY = {
    follow: {
      icon: "👥",
      text: <><span className="font-semibold">Follow someone to fill your Focused Feed</span> — their messages sit together, away from the worldwide feed</>,
      open: () => setShowFollowing(true),
    },
    globe: {
      icon: "🌍",
      text: <><span className="font-semibold">See where kindness is travelling</span> — the globe shows messages crossing the world in real time</>,
      open: () => setShowMap(true),
    },
    glimpse: {
      icon: "💛",
      text: <><span className="font-semibold">Help people see the person behind the kindness</span> — add two playful lines to your profile</>,
      open: () => setShowGlimpseSheet(true),
    },
    wellbeing: {
      icon: "🌤️",
      text: <><span className="font-semibold">How have you been feeling lately?</span> — a quick, private check-in, just for your own reflection</>,
      open: () => setShowWellbeingSheet(true),
    },
    wellbeing_recheck: {
      icon: "🌤️",
      text: <><span className="font-semibold">It's been a while since your last check-in</span> — see how the past few weeks compare</>,
      open: () => setShowWellbeingSheet(true),
    },
  };

  const bellNudges = useMemo(() => {
    if (!profile) return [];
    const accountStartedAt = typeof profile.onboardingCompletedAt === "number"
      ? profile.onboardingCompletedAt
      : firstFeedVisitAt;
    const chosen = pickInvitation({
      accountStartedAt,
      followCount: follows.length,
      hasOpenedGlobe,
      hasGlimpse: Boolean(profile.mostDays || profile.anotherLife),
      hasWellbeing: Boolean(profile.wellbeing),
      lastWellbeingAt: Number(profile.wellbeingAt) || 0,
    });
    if (!chosen) return [];
    const copy = INVITATION_COPY[chosen.id];
    if (!copy) return [];
    // Acting on it counts the same as dismissing it: either way the app has had its say and
    // shouldn't raise it again on the original schedule.
    const settle = () => { snoozeInvitation(chosen.id); setInvitationTick((t) => t + 1); };
    return [{
      id: `inv_${chosen.id}`,
      ts: Date.now(),
      icon: copy.icon,
      text: copy.text,
      onClick: () => { settle(); copy.open(); },
      onDismiss: settle,
    }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, follows.length, hasOpenedGlobe, firstFeedVisitAt, invitationTick]);
  useBackLayer(showWellbeingSheet, () => setShowWellbeingSheet(false));
  const [newMessageIds, setNewMessageIds] = useState(new Set());
  const [seenCountries, setSeenCountries] = useState(new Set());
  const prevMessagesRef = useRef([]);
  const feedRef = useRef(null);
  const scrollHideTimer = useRef(null);
  const [feedDateLabel, setFeedDateLabel] = useState("Today");
  const [feedDateVisible, setFeedDateVisible] = useState(false);

  // Android back button: register every closable layer so back closes the top-most
  // one instead of exiting the app (QA #2). Order of opening = order of closing.
  useBackLayer(Boolean(reactionBarId), () => setReactionBarId(null));
  useBackLayer(pickerOpen, () => setPickerOpen(false));
  useBackLayer(Boolean(glimpse), () => setGlimpse(null));
  useBackLayer(menuOpen, () => setMenuOpen(false));
  useBackLayer(showLevels, () => setShowLevels(false));
  useBackLayer(showUpgrade, () => setShowUpgrade(false));
  useBackLayer(showMap, () => setShowMap(false));
  useBackLayer(showGlimpseSheet, () => setShowGlimpseSheet(false));
  useBackLayer(activeTab !== "feed", () => setActiveTab("feed"));

  const isRealSignedInUser = Boolean(currentUser && !currentUser.isAnonymous);
  // v2 preview: award the daily first-open once per day (defined after isRealSignedInUser to avoid TDZ)
  useEffect(() => { if (isRealSignedInUser) awardPoints("dailyOpen", { oncePerDay: true }); }, [isRealSignedInUser]);
  const isAdmin = currentUser?.email === ADMIN_EMAIL;
  const [showReports, setShowReports] = useState(false);
  const [adminConfirm, setAdminConfirm] = useState(false); // two-step clear-chat confirmation
  const [adminClearing, setAdminClearing] = useState(false);
  const [adminClearError, setAdminClearError] = useState("");
  const [adminResetConfirm, setAdminResetConfirm] = useState(false);
  const [adminResetting, setAdminResetting] = useState(false);
  const [adminResetError, setAdminResetError] = useState("");
  // Community greetings: live approved pool (for the picker) + pending count (admin badge)
  const champions = useChampionGreetings(db, currentUser);            // weekly Top-5 → sendable in picker
  const candidates = useLeaderboardCandidates(db, currentUser);        // approved pool → voting arena
  const userProfileRef = (uid) => doc(db, "users", uid);
  const publicMessagesRef = collection(db, "publicMessages");

  const { streak, freezesAvailable, recordGreetingDay, buyFreeze, useFreeze, sellFreeze } =
    useStreak(db, currentUser?.uid, profile);

  const anim = useAnimations();
  const { burst: reactionBurst, trigger: triggerReactionBurst } = useReactionBurst();

  // Messenger-style unread count on the Feed tab: greetings from others newer than the last
  // time this user viewed the feed (users/{uid}.lastFeedSeenAt). First-ever session (field
  // unset) shows no badge — it initialises on the first feed view.
  const feedUnreadCount = useMemo(() => {
    const seen = profile?.lastFeedSeenAt;
    if (seen == null || !currentUser) return 0;
    return messages.filter(
      (m) => m.uid !== currentUser.uid && m.uid !== "system" && typeof m.timestamp === "number" && m.timestamp > seen
    ).length;
  }, [messages, profile?.lastFeedSeenAt, currentUser]);

  // Mark the feed as seen while the user is actually looking at it. The short delay lets a
  // returning user notice the badge before it clears (it clears once they've been on the
  // feed for a moment, like a read receipt).
  useEffect(() => {
    if (!currentUser || currentUser.isAnonymous || !profile || activeTab !== "feed" || !messages.length) return;
    const newest = messages.reduce((a, m) => (typeof m.timestamp === "number" && m.timestamp > a ? m.timestamp : a), 0);
    if (!newest || newest <= (profile.lastFeedSeenAt ?? 0)) return;
    const t = setTimeout(() => {
      setDoc(userProfileRef(currentUser.uid), { lastFeedSeenAt: newest }, { merge: true }).catch(() => {});
    }, 2500);
    return () => clearTimeout(t);
  }, [currentUser, profile, activeTab, messages]);

  useEffect(() => {
    let unsubscribeProfile = null;
    let retryTimer = null;
    let profileWatchdog = null;
    let profileSettled = false; // success or give-up reached; watchdog is a no-op after this
    let attempts = 0;

    // Consume any pending Google redirect sign-in so the session is established on load
    // (the installed-app fallback uses signInWithRedirect). onAuthStateChanged then fires with the user.
    // Skip on native iOS: there's no web redirect to consume there (native uses signInWithCredential),
    // and calling it forces the web redirect resolver/iframe that hangs in the WKWebView.
    if (!isNativeIOS()) getRedirectResult(auth).catch(() => {});

    // Failsafe: if auth init ever stalls (e.g. a webview quirk) and onAuthStateChanged never fires,
    // don't trap the user on an infinite loading spinner — degrade to the sign-in screen after 6s.
    const authFailsafe = setTimeout(() => setIsAuthLoading(false), 6000);

    // Second failsafe, for the profile read rather than auth. The one above only covers
    // onAuthStateChanged never firing; once it HAS fired for a signed-in user the loading
    // gate is held by `profileChecked`, and nothing was watching that.
    //
    // A Firestore *error* is handled — it retries, then lands on the "Having trouble loading
    // your profile · Reload" screen. A thrown *exception* in the success handler is not: it
    // skips setProfileChecked(true), no error state is ever set, and the app sits on a
    // spinner forever with no way out but reinstalling. That happened, in 0d197c9, from a
    // one-word mistake. The specific bug is fixed; this makes the whole shape of it
    // survivable, by routing any silent stall into the recoverable screen that already exists.
    const armProfileWatchdog = () => {
      clearTimeout(profileWatchdog);
      profileWatchdog = setTimeout(() => {
        if (profileSettled) return;
        // Still waiting after 12s with nothing to show for it — surface the Reload screen.
        // A plain flag rather than reading state: a setState updater must be pure, and this
        // needs a side effect. The flag also can't go stale the way a closed-over state
        // value would, which matters in an effect with an empty dependency array.
        setProfileLoadError("timeout"); setIsProfileLoading(false);
      }, 12000);
    };

    const subscribeProfile = (user) => {
      const onboardedKey = "seen_onboarded_" + user.uid;
      armProfileWatchdog();
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
          profileSettled = true; clearTimeout(profileWatchdog);
          setProfileLoadError(""); setProfileChecked(true); setIsProfileLoading(false);

          // Backfill publicProfiles for accounts that predate the split, and repair drift if
          // a profile was ever edited without the mirror being written. Reads only this
          // user's own documents and no-ops when already in step.
          //
          // Two things about the placement, both learned the hard way. It uses `user` (this
          // subscription's own argument), NOT the `currentUser` state — this effect has an
          // empty dependency array, so its closure holds `currentUser` as it was on the first
          // render, which is null. And it runs AFTER the setters above rather than before:
          // this is best-effort work, and nothing best-effort may sit on the path to
          // setProfileChecked(true). It did, it threw on null.uid, and every already-onboarded
          // user was left on the loading spinner forever.
          if (done) { try { ensurePublicProfile(db, user.uid); } catch { /* best-effort */ } }
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
            profileSettled = true; clearTimeout(profileWatchdog);
            setProfileLoadError(error?.code || "unknown"); setIsProfileLoading(false);
          }
        }
      );
    };

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      clearTimeout(authFailsafe);
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
      profileSettled = false;
      setProfileChecked(false); setProfileLoadError(""); setIsProfileLoading(true);
      subscribeProfile(user);
    });
    return () => {
      clearTimeout(authFailsafe);
      clearTimeout(profileWatchdog);
      if (unsubscribeProfile) unsubscribeProfile();
      if (retryTimer) clearTimeout(retryTimer);
      unsubscribeAuth();
    };
  }, []);

  // Blocked users — live set of uids the user has blocked, used to hide their content from the
  // feed (Firestore: users/{uid}/blockedUsers/{blockedUid}). Private to the owner (see rules).
  useEffect(() => {
    if (!isRealSignedInUser || !currentUser?.uid) { setBlockedUids(new Set()); return; }
    const unsub = onSnapshot(
      collection(db, "users", currentUser.uid, "blockedUsers"),
      (snap) => setBlockedUids(new Set(snap.docs.map((d) => d.id))),
      () => {} // read failures are non-fatal — just means no filtering this session
    );
    return () => unsub();
  }, [isRealSignedInUser, currentUser?.uid]);

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

  // v2: the guided spotlight tour is retired — contextual coach-marks teach at the moment
  // of first use instead. `tourActive` stays (always false) so coach-mark gating is untouched.

  const finishTour = useCallback(() => {
    setPickerOpen(false);
    setReactionBarId(null);
    setMenuOpen(false);
    setTourActive(false);
    if (currentUser?.uid) {
      setDoc(doc(db, "users", currentUser.uid), { tourCompletedVersion: TOUR_VERSION, tourCompletedAt: serverTimestamp() }, { merge: true }).catch(() => {});
    }
  }, [currentUser]);

  // Safety net: whenever the tour deactivates, force the ⋯ menu closed so a tour can never
  // strand the user on an open menu. Fires only on the tourActive transition, so it never
  // interferes with the user opening the menu manually.
  useEffect(() => { if (!tourActive) setMenuOpen(false); }, [tourActive]);

  // Arm a menu "open lock" the moment auth completes — covers BOTH the Google and the
  // email/password sign-in paths. While the lock is active (a few seconds after sign-in) OR
  // while the guided tour is running, any attempt to open the ⋯ menu is ignored, so sign-in
  // always lands on the feed. (A stray tap/ghost-click on the ⋯ button right after sign-in was
  // popping the menu open; closing is always allowed, only opening is gated.)
  const menuOpenLockUntilRef = useRef(0);
  const tourActiveRef = useRef(false);
  tourActiveRef.current = tourActive;
  const signedInLockRef = useRef(false);
  useEffect(() => {
    if (isRealSignedInUser && !signedInLockRef.current) {
      signedInLockRef.current = true;
      menuOpenLockUntilRef.current = Date.now() + 3000;
      setMenuOpen(false);
    }
    if (!isRealSignedInUser) signedInLockRef.current = false;
  }, [isRealSignedInUser]);

  // Guarded menu open — swallows an "open" fired during the lock window or while the tour runs.
  const handleMenuOpenChange = useCallback((v) => {
    if (v && (tourActiveRef.current || Date.now() < menuOpenLockUntilRef.current)) return;
    setMenuOpen(v);
  }, []);

  const tourSteps = useMemo(() => [
    {
      key: "send",
      target: '[data-tour="send"]',
      title: "Welcome to Seen 👋",
      body: "Send a kind greeting to a real stranger somewhere in the world. They'll feel seen — and so will you.",
      before: () => { setPickerOpen(false); setReactionBarId(null); },
    },
    {
      key: "categories",
      target: '[data-tour="categories"]',
      title: "Choose the right words",
      body: "Community, Greetings, Warmth, Calm & Local — send a winning community greeting or a phrase in your own language.",
      before: () => { setMenuOpen(false); setPickerOpen(true); },
    },
    {
      key: "connect",
      target: '[data-tour="connect"]',
      extraPadTop: 70,
      title: "Press & hold any message",
      body: "Long-press a message to send a ❤️ — and tap anyone's name to see a little glimpse of who they are.",
      before: () => {
        setPickerOpen(false);
        const others = messages.filter((m) => m.uid && m.uid !== currentUser?.uid);
        const other = others[Math.floor(others.length * 0.65)] ?? others[0];
        if (other) {
          const el = document.querySelector(`[data-msg-id="${other.id}"]`);
          if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
          setReactionBarId(other.id);
        }
      },
    },
    {
      key: "tabs",
      target: '[data-tour="tab-nav"]',
      title: "Explore the app",
      body: "🌱 Community — vote greetings into the weekly Top 5.  📖 Board — your growing kindness story.  💡 Life Hacks — daily tips for mind & body.",
      before: () => { setReactionBarId(null); setPickerOpen(false); setMenuOpen(false); },
    },
    {
      key: "menu-intro",
      target: '[data-tour="menu"]',
      title: "There's more in here",
      body: "Tap ⋯ anytime for your World Map, Person behind the Kindness, Journal, Wellbeing check-in and Support.",
      // Never opens the menu — keeping the tour off the live menu state guarantees you land on the feed.
      before: () => { setPickerOpen(false); setMenuOpen(false); },
    },
    {
      key: "journey",
      target: null,
      title: "That's your journey",
      body: "Send kindness daily, keep your streak alive, and watch your impact light up the world map. Ready?",
      before: () => { setReactionBarId(null); setMenuOpen(false); },
    },
  ], [messages, currentUser]);

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
      retryTimer = setTimeout(() => new Notification(msg.title, { body: msg.body, icon: "/icon-192.png", badge: "/badge-96.png" }), target.getTime() - now.getTime());
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

  // Change password for an email/password account: re-authenticate with the current
  // password (Firebase requires a recent login), then set the new one.
  const changePassword = async (currentPassword, newPassword) => {
    const user = auth.currentUser;
    if (!user?.email) return { error: "You need to be signed in to change your password." };
    try {
      const cred = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, cred);
      await updatePassword(user, newPassword);
      return { ok: true };
    } catch (error) {
      if (error?.code === "auth/wrong-password" || error?.code === "auth/invalid-credential")
        return { error: "Your current password is incorrect." };
      if (error?.code === "auth/weak-password")
        return { error: "New password is too weak — use at least 6 characters." };
      if (error?.code === "auth/requires-recent-login")
        return { error: "For your security, please sign out and back in, then try again." };
      if (error?.code === "auth/too-many-requests")
        return { error: "Too many attempts. Please wait a moment and try again." };
      return { error: "Unable to change your password right now." };
    }
  };

  const signInWithGoogle = async () => {
    setIsGoogleSigningIn(true); setAuthError(""); setEmailLinkMessage("");
    try {
      // Native iOS: Google blocks its OAuth flow inside app web-views, so use the real native
      // Google sheet via the Firebase Authentication Capacitor plugin, then sign the JS SDK in
      // with the returned credential. Web/dev uses the Firebase popup/redirect flow.
      if (isNativeIOS()) {
        const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
        // Native Google sheet → returns the credential → sign the JS SDK in. No artificial timeout:
        // the flow is interactive (system prompt + account chooser can take longer than any short
        // timeout), and it resolves on completion or rejects on cancel/error on its own.
        const result = await FirebaseAuthentication.signInWithGoogle({ skipNativeAuth: true });
        const idToken = result?.credential?.idToken;
        const accessToken = result?.credential?.accessToken;
        if (!idToken && !accessToken) throw new Error("google-no-credential");
        const credential = GoogleAuthProvider.credential(idToken, accessToken);
        await signInWithCredential(auth, credential);
        return;
      }
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      if (error?.message === "google-no-credential" || error?.code === "auth/user-cancelled") { /* user cancelled */ }
      else if (error?.code === "auth/popup-blocked" || error?.code === "auth/cancelled-popup-request") {
        await signInWithRedirect(auth, googleProvider); return;
      }
      else if (error?.code === "auth/unauthorized-domain") setAuthError(`This domain is not in Firebase Authorized domains.`);
      else if (error?.code === "auth/operation-not-allowed") setAuthError("Google sign-in is not enabled.");
      else setAuthError("Google sign-in failed. Please try again.");
    } finally { setIsGoogleSigningIn(false); }
  };

  // Sign in with Apple — required by App Store Guideline 4.8 since we offer Google sign-in.
  // Native iOS uses the real Apple sheet (ASAuthorization) via the Firebase Authentication
  // Capacitor plugin, then signs the JS SDK in with the returned credential so onAuthStateChanged
  // fires as usual. Web/dev falls back to the Firebase popup/redirect OAuth flow.
  const signInWithApple = async () => {
    setIsGoogleSigningIn(true); setAuthError(""); setEmailLinkMessage("");
    try {
      if (isNativeIOS()) {
        const { FirebaseAuthentication } = await import("@capacitor-firebase/authentication");
        const result = await FirebaseAuthentication.signInWithApple({ skipNativeAuth: true });
        const idToken = result?.credential?.idToken;
        const rawNonce = result?.credential?.nonce;
        if (!idToken) throw new Error("apple-no-credential");
        const provider = new OAuthProvider("apple.com");
        const credential = provider.credential({ idToken, rawNonce });
        await signInWithCredential(auth, credential);
        return;
      }
      const appleProvider = new OAuthProvider("apple.com");
      appleProvider.addScope("email");
      appleProvider.addScope("name");
      await signInWithPopup(auth, appleProvider);
    } catch (error) {
      if (error?.code === "auth/popup-blocked" || error?.code === "auth/cancelled-popup-request") {
        const appleProvider = new OAuthProvider("apple.com");
        appleProvider.addScope("email"); appleProvider.addScope("name");
        await signInWithRedirect(auth, appleProvider); return;
      }
      if (error?.code === "auth/operation-not-allowed") setAuthError("Apple sign-in is not enabled.");
      else if (error?.code === "auth/user-cancelled" || error?.message === "apple-no-credential") { /* user cancelled */ }
      else setAuthError("Apple sign-in failed. Please try again.");
    } finally { setIsGoogleSigningIn(false); }
  };

  useEffect(() => {
    if (!currentUser || currentUser.isAnonymous) return;
    let retryTimer = null;
    // A month, not a week. timestamp is written as a number (nowMs()), so a plain numeric
    // cutoff works, and because the range and the orderBy are on the SAME field this still
    // needs no composite index.
    //
    // The limit is what actually bounds the feed: once there are more than LIMIT messages
    // inside the window you get the newest LIMIT regardless of how far back the window
    // reaches, so widening 7→30 days without also raising this would have changed nothing
    // except while the app is quiet.
    const FEED_WINDOW_DAYS = 30;
    const FEED_LIMIT = 300;
    const cutoff = Date.now() - FEED_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    const q = query(publicMessagesRef, where("timestamp", ">", cutoff), orderBy("timestamp", "desc"), limit(FEED_LIMIT));
    const unsubscribe = onSnapshot(q,
      (snap) => {
        // Legacy mystery greetings are dropped rather than rendered. Their stored `text` was
        // only ever the placeholder "🎁 Mystery Greeting" — the warm line was picked on the
        // reader's device at unwrap time and never written down. With the feature gone there
        // is nothing behind these documents to show.
        const live = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((m) => !m.isMystery);
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
        try { localStorage.setItem("seen_feed_cache", JSON.stringify(finalMessages.slice(0, 30))); } catch {}
        setIsChatLive(true); setChatError(""); setLastLiveAt(new Date());
      },
      (error) => {
        setIsChatLive(false); setChatError(error?.code || "unknown");
        retryTimer = setTimeout(() => setChatRetryCount((c) => c + 1), 3000);
      }
    );
    return () => { if (retryTimer) clearTimeout(retryTimer); unsubscribe(); };
  }, [currentUser, chatRetryCount]);


  const isPremium = true; // all features free — grow the user base
  const sparkBalance = Number(profile?.sparkBalance ?? 0);
  // v2 tree balance = real sparks + device-local preview points (grows the Kindness Tree)
  const currentLevel = useMemo(() => LEVEL_THRESHOLDS.reduce((l, t) => sparkBalance >= t.min ? t : l, LEVEL_THRESHOLDS[0]), [sparkBalance]);
  const nextLevel = useMemo(() => LEVEL_THRESHOLDS.find((t) => t.min > sparkBalance) || null, [sparkBalance]);
  const progressPercent = useMemo(() => {
    if (!nextLevel) return 100;
    const span = nextLevel.min - currentLevel.min;
    return span <= 0 ? 100 : Math.max(0, Math.min(100, Math.round(((sparkBalance - currentLevel.min) / span) * 100)));
  }, [currentLevel.min, nextLevel, sparkBalance]);

  const { displayed: displayedSparks, flashing: sparksFlashing } = useSparkCounter(sparkBalance);
  const animatedProgress = useProgressBarFill(progressPercent);
  // Level-up chime — fires when the spark level crosses into a higher tier (placed AFTER
  // currentLevel is declared to avoid a temporal-dead-zone crash).
  const prevLevelRef = useRef(currentLevel.min);
  useEffect(() => {
    if (currentLevel.min > prevLevelRef.current) playLevelUp();
    prevLevelRef.current = currentLevel.min;
  }, [currentLevel.min]);
  // World-map ambient drone — starts when the globe opens, stops when it closes.
  useEffect(() => {
    if (showMap) startMapAmbient(); else stopMapAmbient();
    return () => stopMapAmbient();
  }, [showMap]);

  const todayMessageCount = useMemo(() =>
    messages.filter((m) => m.uid === currentUser?.uid && m.timestamp > startOfToday()).length,
    [messages, currentUser]
  );

  // What this user has written in their own words recently, joined into one string for the
  // distress check behind the crisis banner. Only their own personal posts, only the last
  // 24 hours — a canned greeting isn't self-report, and a bad day from last week shouldn't
  // keep the banner pinned to the top of the feed.
  const recentOwnWriting = useMemo(() => {
    const dayAgo = Date.now() - 86400000;
    return messages
      .filter((m) => m.isPersonal && m.uid === currentUser?.uid && (Number(m.timestamp) || 0) > dayAgo)
      .map((m) => m.text || "")
      .join(" ");
  }, [messages, currentUser]);

  // Crisis routes for THIS user's country — see the banner below.
  const crisisEmergency = useMemo(() => getEmergency(profile?.country), [profile?.country]);
  const crisisLines = useMemo(() => (getResources(profile?.country).crisis || []).slice(0, 3), [profile?.country]);

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
      // Show the welcome moment IMMEDIATELY (before the profile write). Otherwise the profile
      // onSnapshot fires the instant setDoc lands — flipping hasCompletedOnboarding true and
      // rendering the feed underneath for a beat before this function reaches its end and sets
      // the overlay. Setting it up-front means the "Let's go" welcome covers the feed the whole
      // time it loads → welcome screen first, then feed (no flash). Reset on error below.
      setShowWelcomeMoment(true);
      let profilePhotoUrl = profile?.profilePhotoUrl || "";
      if (data.profilePhoto instanceof File) {
        const ext = data.profilePhoto.name.split(".").pop()?.toLowerCase() || "jpg";
        const photoRef = ref(storage, `profilePhotos/${user.uid}/avatar.${ext}`);
        await uploadBytes(photoRef, data.profilePhoto, { contentType: data.profilePhoto.type });
        profilePhotoUrl = await getDownloadURL(photoRef);
      }
      await setDoc(userProfileRef(user.uid), {
        fullName: data.fullName, email: normalizedEmail, country: data.country, dob: data.dob,
        mostDays: (data.mostDays || "").trim(), anotherLife: (data.anotherLife || "").trim(),
        profilePhotoUrl, ownerUid: user.uid, sparkBalance: Number(profile?.sparkBalance ?? 0),
        updatedAt: serverTimestamp(), onboardingCompletedAt: serverTimestamp(),
      }, { merge: true });

      // Publish the readable subset so other members can see (and search for) this person
      // without `users` having to be world-readable. See src/publicProfile.js.
      syncPublicProfile(db, user.uid, {
        fullName: data.fullName, country: data.country, profilePhotoUrl,
        mostDays: (data.mostDays || "").trim(), anotherLife: (data.anotherLife || "").trim(),
      });

      // Wellbeing baseline — recorded from the onboarding check-in step
      if (data.wellbeing) {
        try { await saveCheckin(db, user.uid, data.wellbeing); } catch (_) {}
      }

      // Referral reward — award +50 Sparks to both users
      const pendingRef = localStorage.getItem("seen_ref");
      if (pendingRef && pendingRef !== user.uid) {
        try {
          const referralDocRef = doc(db, "referrals", user.uid);
          const newUserRef = userProfileRef(user.uid);
          const referrerRef = doc(db, "users", pendingRef);
          // The referrer's balance is bumped with increment() rather than read-then-add.
          // Two reasons: it's the correct concurrency-safe primitive anyway, and it means the
          // referral reward needs no READ of another member's `users` doc — which is what
          // lets that collection close to its owner. `update` on a missing document throws,
          // so an invalid referrer still aborts the transaction exactly as the old
          // `referrerSnap.exists()` check did.
          await runTransaction(db, async (tx) => {
            const [existing, newUserSnap] = await Promise.all([
              tx.get(referralDocRef), tx.get(newUserRef),
            ]);
            if (existing.exists()) return; // already rewarded
            const newUserSparks = newUserSnap.exists() ? (newUserSnap.data().sparkBalance ?? 0) : 0;
            tx.set(referralDocRef, { referrerUid: pendingRef, newUserUid: user.uid, awardedAt: serverTimestamp() });
            tx.update(referrerRef, { sparkBalance: increment(50) });
            tx.set(newUserRef, { sparkBalance: newUserSparks + 50 }, { merge: true });
          });
          localStorage.removeItem("seen_ref");
        } catch (err) { console.error("Referral award error:", err); }
      }

      setPendingProfileData(null); setPendingOnboardingDetails(null); setHasCompletedOnboarding(true); setOnboardingStep("done"); setShowWelcomeMoment(true);
    } catch (error) {
      setShowWelcomeMoment(false); // save failed — drop the welcome overlay, show the form + error
      if (error?.code === "storage/unauthorized") { setOnboardingError("Storage rules are blocking photo upload."); return; }
      if (error?.code === "permission-denied") { setOnboardingError("Firestore rules are blocking profile save."); return; }
      if (error?.code === "unavailable") { setOnboardingError("Firebase is temporarily unavailable."); return; }
      setOnboardingError(error?.code ? `Unable to save your profile (${error.code}).` : "Unable to save your profile right now.");
    } finally { setIsSavingProfile(false); }
  };

  const DAILY_GREETING_LIMIT = 50;
  const haptic = (pattern = [8]) => { try { navigator.vibrate?.(pattern); } catch(_) {} };

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

  const handleFeedScroll = (e) => {
    const container = e.currentTarget;
    setFeedDateVisible(true);
    const containerTop = container.getBoundingClientRect().top;
    let label = "Today";
    container.querySelectorAll("[data-daylabel]").forEach((el) => {
      if (el.getBoundingClientRect().top <= containerTop + 48) {
        label = el.dataset.daylabel;
      }
    });
    setFeedDateLabel(label);
    clearTimeout(scrollHideTimer.current);
    scrollHideTimer.current = setTimeout(() => setFeedDateVisible(false), 1500);
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
        // moodTag (health-adjacent, special-category) is no longer written into the world-readable
        // public feed — it stays on the private profile doc only.
        country: profile?.country ?? null,
        // Always false. The mystery greeting is gone, but the field stays on new documents
        // so old and new rows in publicMessages keep the same shape.
        isMystery: false,
        isPremium: isPremium,
        sparkReward: earnedSparks,
      });

      // Message is written — close picker and play animations immediately
      setPickerOpen(false);
      setIsSending(false);
      setSentToast(SEND_AFFIRMATIONS[Math.floor(Math.random() * SEND_AFFIRMATIONS.length)]); // giving-focused confirmation
      // Feed is newest-at-top, but the Send bar is at the bottom — glide the feed up so the
      // sender SEES their greeting land at the top (closes the send→top spatial mismatch).
      requestAnimationFrame(() => feedRef.current?.scrollTo({ top: 0, behavior: "smooth" }));
      const newStreak = streak + 1;
      anim.triggerSparkBurst(85, 92);
      haptic([10, 30, 10]);
      awardPoints("send"); // v2 preview: waters the Kindness Tree (device-local)
      if (hasSent) playSend(); else playFirstSend(); // giving-is-the-reward sound
      const sendTs = Date.now();
      setLastSendTime(sendTs);
      try { localStorage.setItem("seen_last_send_time", String(sendTs)); } catch (_) {}
      // Bust the impact cache so the next tab open reflects this new greeting
      try { ["7d","30d"].forEach(p => localStorage.removeItem(`seen_react_v1_${p}_${currentUser.uid}`)); } catch (_) {}
      if (!hasSent) {
        // First send ever — skip the prompt, open the globe automatically so they
        // see their arc flying to another country, then (v2) glide straight to the
        // Kindness Tree so they watch their kindness water the seed.
        setHasSent(true);
        try { localStorage.setItem("seen_has_sent", "1"); } catch (_) {}
        setTimeout(() => setShowMap(true), 1100);
        let firstV2 = false;
        try { firstV2 = !localStorage.getItem("seen_v2_first_send_done"); } catch (_) {}
        if (firstV2) {
          try { localStorage.setItem("seen_v2_first_send_done", "1"); } catch (_) {}
          setAutoWaterTree(true);
          setTimeout(() => { setShowMap(false); setShowLevels(true); }, 4200);
        }
      } else {
        setShowMapPrompt(true);
      }
      if ([3, 7, 14, 30].includes(newStreak)) {
        setTimeout(() => { anim.triggerStreakConfetti(); playStreak(); }, 300);
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
            // Durable lifetime "messages sent" tally (transactional, can't lose increments) —
            // powers the Board's accurate "Messages sent" circle without a composite index.
            greetingsSentCount: Number(profileData?.greetingsSentCount ?? 0) + 1,
          }, { merge: true });
        }),
        recordGreetingDay(),
      ]).catch((err) => console.error("Reward update failed:", err));

      // Ripple attribution — strictly best-effort, never affects sending.
      // If I recently reacted to someone's greeting and am now sending my own,
      // their kindness "rippled" to me. Credit each original sender once.
      recordRipples();

      // Community greeting credit — bump sentCount + award the author a small spark
      // bonus (self-sends excluded). Best-effort; never affects the sender's flow.
      if (greeting.submissionId) {
        recordCommunitySend(db, greeting, currentUser.uid);
      }

    } catch (err) {
      console.error("Send failed:", err);
      setSendError("Couldn't send — please try again.");
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

  // Community greetings are AI-moderated at submit (api/submit-greeting) and champions rotate
  // automatically via the weekly cron — so there's no admin approve/reject/promote flow here.

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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-0 sm:p-6">
        <div className="relative flex h-[100dvh] w-full max-w-md flex-col overflow-hidden rounded-none border border-white/80 bg-white/95 shadow-2xl backdrop-blur sm:h-[90vh] sm:rounded-3xl">
          {unauthScreen === "welcome"
            ? <WelcomeStep onStartJourney={() => setUnauthScreen("signin")} db={db} auth={auth} />
            : <SignInStep onEmailLinkSignIn={sendEmailSignInLink} onPasswordSignIn={signInWithPassword}
                onPasswordSignUp={signUpWithPassword} onForgotPassword={forgotPassword} onGoogleSignIn={signInWithGoogle} onAppleSignIn={isNativeIOS() ? signInWithApple : undefined}
                loading={isEmailActionLoading} googleLoading={isGoogleSigningIn} googleError={authError}
                emailLinkMessage={emailLinkMessage} authError={authError} />}
        </div>
      </div>
    );
  }

  const firstName = profile?.fullName?.trim()?.split(" ")?.[0] || currentUser?.displayName?.split(" ")?.[0] || "there";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-teal-950 p-0 sm:p-6">
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

      {/* p-0 on mobile: the shell is EXACTLY 100dvh, so the page itself has nothing to scroll —
          this is what stopped the whole "app box" being draggable on Android/iOS. */}
      <div {...(darkMode ? { "data-dark-shell": "" } : {})} className="relative flex h-[100dvh] w-full max-w-md flex-col overflow-hidden rounded-none sm:h-[90vh] sm:rounded-3xl" style={darkMode ? {} : { background: "#fff", border: "1px solid rgba(0,0,0,0.06)", boxShadow: "0 8px 32px rgba(0,0,0,0.12)" }}>


        {showProfileCard && (
          <ProfileCard profile={profile} onClose={() => setShowProfileCard(false)} db={db} currentUser={currentUser}
            onOpenBlocked={() => setShowBlockedApp(true)}
            onOpenChangePassword={() => setShowChangePasswordApp(true)} />
        )}
        {showBlockedApp && (
          <BlockedAccountsPanel db={db} currentUser={currentUser} onClose={() => setShowBlockedApp(false)} />
        )}
        {showChangePasswordApp && (
          <ChangePasswordPanel currentUser={currentUser} onChangePassword={changePassword} onClose={() => setShowChangePasswordApp(false)} />
        )}
        {showFollowing && (
          <FollowingPanel
            follows={follows}
            messages={messages}
            db={db}
            currentUser={currentUser}
            blockedUids={blockedUids}
            onSetLabel={setFollowLabel}
            onUnfollow={unfollow}
            onFollow={followProfile}
            onClose={() => setShowFollowing(false)} />
        )}
        {reactorsFor && (
          <MessageReactionsPanel db={db} message={reactorsFor} currentUser={currentUser} blockedUids={blockedUids} onClose={() => setReactorsFor(null)} />
        )}

        {showReports && isAdmin && (
          <ModerationQueue db={db} darkMode={darkMode} onClose={() => setShowReports(false)} />
        )}

        {glimpse && (
          <UserGlimpse db={db} uid={glimpse.uid} country={glimpse.country} name={glimpse.name} onClose={() => setGlimpse(null)} />
        )}


        {!isNativeIOS() && showUpgrade && <PremiumUpgradePrompt country={profile?.country} currentUser={currentUser} onClose={() => setShowUpgrade(false)} />}

        {/* Kindness loop sheets */}
        {postComposerOpen && (
          <PostComposer
            profile={profile}
            myUid={currentUser?.uid}
            currentUser={currentUser}
            db={db}
            streak={streak}
            sparkBalance={sparkBalance}
            onClose={() => setPostComposerOpen(false)} />
        )}
        {replyTarget && (
          <PrivateReplySheet
            target={replyTarget}
            me={profile}
            myUid={currentUser?.uid}
            currentUser={currentUser}
            db={db}
            blockedUids={blockedUids}
            onClose={() => setReplyTarget(null)} />
        )}
        {showWellbeingSheet && currentUser && createPortal(
          <div data-portal className="fixed inset-0 z-[240] flex flex-col justify-end">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => setShowWellbeingSheet(false)} />
            <div className="relative sheet-slide-up rounded-t-3xl bg-white shadow-2xl max-h-[90dvh] overflow-y-auto flex flex-col" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-center pt-3 pb-2 flex-shrink-0"><div className="w-10 h-1 rounded-full bg-slate-200" /></div>
              <div className="px-5 pb-2 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-800">A quick wellbeing check-in</h2>
                <button onClick={() => setShowWellbeingSheet(false)} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Close"><X size={20} /></button>
              </div>
              <div className="px-5 pb-8">
                <p className="text-[13px] text-slate-500 leading-relaxed mb-3">Just for your own reflection — it's not a medical test, and you can look back on it over time.</p>
                {wellbeingError && (
                  <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-center text-xs font-semibold text-red-600" role="alert">{wellbeingError}</p>
                )}
                <WellbeingCheckin
                  submitLabel="Save check-in"
                  onComplete={async (scores) => {
                    // Only dismiss on success. This used to swallow the error and dismiss
                    // regardless, so a failed save lost five answered questions AND stopped
                    // the prompt ever returning.
                    try {
                      setWellbeingError("");
                      await saveCheckin(db, currentUser.uid, scores);
                      // wellbeingAt is what the re-check invitation measures against. The
                      // scores map alone carries no date, and the subcollection copy would
                      // need a separate query just to answer "how long ago was this?".
                      await setDoc(userProfileRef(currentUser.uid), { wellbeing: scores, wellbeingAt: Date.now() }, { merge: true });
                    } catch {
                      setWellbeingError("Couldn't save your check-in — check your connection and try again.");
                      return;
                    }
                    // No dismissal flag to set: the invitation's own `when` predicate reads
                    // `profile.wellbeing`, so saving a check-in retires the invitation by
                    // making it ineligible. A separate boolean would be a second source of
                    // truth that could disagree with the profile.
                    setShowWellbeingSheet(false);
                  }}
                />
              </div>
            </div>
          </div>,
          document.body
        )}
        {showGlimpseSheet && currentUser && (
          <GlimpsePromptSheet
            initial={{ mostDays: profile?.mostDays, anotherLife: profile?.anotherLife }}
            onSave={async (fields) => {
              await setDoc(userProfileRef(currentUser.uid), fields, { merge: true });
              syncPublicProfile(db, currentUser.uid, { ...profile, ...fields });
              // Same as the wellbeing sheet: answering retires the invitation because its
              // `when` reads profile.mostDays / profile.anotherLife.
            }}
            onClose={() => setShowGlimpseSheet(false)}
          />
        )}

        {/* v2: green welcome-moment screen removed (onboarding is near-zero friction now) */}


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
                  onPasswordSignUp={signUpWithPassword} onForgotPassword={forgotPassword} onGoogleSignIn={signInWithGoogle} onAppleSignIn={isNativeIOS() ? signInWithApple : undefined}
                  loading={isEmailActionLoading} googleLoading={isGoogleSigningIn} googleError={authError}
                  emailLinkMessage={emailLinkMessage} authError={authError} />
              ) : pendingOnboardingDetails ? (
                <div className="seen-auth-bg h-full w-full overflow-y-auto bg-gradient-to-b from-[#FFF6EF] via-[#f7f7f6] to-[#f6f5f2] px-6 pt-8 pb-10">
                  <div className="mx-auto w-full max-w-sm">
                    <div className="flex justify-center pb-3">
                      <img src="/icon-192.png" alt="" width={68} height={68} className="rounded-[19px] shadow-md" />
                    </div>
                    <h1 className="seen-auth-title font-display text-center text-[34px] leading-[1.08] font-normal tracking-[-0.04em]">A quick wellbeing check-in</h1>
                    <p className="seen-auth-sub pb-4 text-center text-[16px] leading-tight">A quick, gentle check-in (it asks about the past two weeks) — just for your own reflection, not a medical test. You can look back on it over time. You're welcome to skip it.</p>
                    <WellbeingCheckin
                      submitLabel="Finish & enter Seen"
                      onComplete={async (scores) => { setOnboardingError(""); await completeOnboarding({ ...pendingOnboardingDetails, wellbeing: scores }); }}
                    />
                    <button
                      type="button"
                      onClick={async () => { setOnboardingError(""); await completeOnboarding({ ...pendingOnboardingDetails }); }}
                      className="mt-3 w-full text-center text-[13px] font-semibold text-slate-400 hover:text-slate-600 transition-colors">
                      Skip for now
                    </button>
                    {onboardingError && <p className="px-1 mt-2 text-center text-sm text-rose-600">{onboardingError}</p>}
                  </div>
                </div>
              ) : (
                <Onboarding onContinue={async (data) => { setOnboardingError(""); await completeOnboarding(data); }}
                  loading={isSavingProfile} initialData={pendingProfileData}
                  initialEmail={currentUser?.email || ""} errorMessage={onboardingError} />
              )}
            </>
          )
        ) : (
          <>
            {/* ── HEADER ── v2: no longer collapsible. The expanding drawer only ever held the
                 tree chip (now in Growth) and two self-hiding banners, so tapping the name
                 just opened an empty gap. Banners render inline below instead. */}
            {/* z-[35], not z-10. `backdrop-blur` makes this header its own stacking context, so
                the notification dropdown's z-50 only ranks it against its siblings INSIDE the
                header — against the page, the whole thing sat at z-10. The feed's sticky
                section headers are z-[25] and z-30, so they painted straight over the open
                dropdown, which is why "Focused Feed · Manage" appeared between its rows.
                35 clears those two and still sits under the greeting picker at z-40, which is
                a full-screen sheet and should cover the header. */}
            <header className="border-b border-slate-100 bg-white/90 backdrop-blur z-[35] flex-shrink-0" style={{ paddingTop: "env(safe-area-inset-top)" }}>
              <div className="flex items-center justify-between px-4 py-2.5 select-none">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <h1 className="text-sm font-bold text-slate-800 truncate">Hey {firstName}</h1>
                  </div>
                  <LiveGreeterCount db={db} currentUser={currentUser} compact />
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
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
                      onClick={toggleSound}
                      className="flex h-11 w-11 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 active:scale-90 transition-all"
                      aria-label={soundOn ? "Turn sounds off" : "Turn sounds on"}
                      title={soundOn ? "Sounds on" : "Sounds off"}>
                      {soundOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
                    </button>
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <NotificationBell streak={streak} db={db} currentUser={currentUser} hasSentGreeting={hasSent} nudges={bellNudges} />
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <MeatballMenu
                      open={menuOpen}
                      onOpenChange={handleMenuOpenChange}
                      onWorld={() => setShowMap(true)}
                      onShare={() => setShowProfileCard(true)}
                      onFollowing={() => setShowFollowing(true)}
                      followCount={follows.length}
                      onUpgrade={() => { if (!isNativeIOS()) setShowUpgrade(true); }}
                      onSupport={() => setActiveTab("support")}
                      onChangePassword={changePassword}
                      onKindnessTree={() => setShowLevels(true)}
                      darkMode={darkMode}
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
                      isAdmin={isAdmin}
                      onAdminReports={() => setShowReports(true)}
                      onAdminClearFeed={() => setAdminConfirm(true)}
                      onAdminFullReset={() => setAdminResetConfirm(true)}
                    />
                  </div>
                </div>
              </div>

              {/* Banners only — both children self-hide, and `.seen-header-rail:empty`
                  collapses the rail itself, so the header adds zero height when there's
                  nothing to say. */}
              <div className="seen-header-rail px-4 pb-2 space-y-1 border-t border-slate-100 pt-2">
                <NotificationPermissionBanner onPermissionChange={() => setNotifPermission(Notification.permission)} />
                {!isChatLive && chatError && (
                  <p className="rounded-xl border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                    Chat offline ({chatError}).
                  </p>
                )}
              </div>
            </header>

            {showLevels && (
              <KindnessTreePanel sparkBalance={sparkBalance} darkMode={darkMode} autoWater={autoWaterTree} onClose={() => { setShowLevels(false); setAutoWaterTree(false); }} />
            )}

            {openStory && (
              <FeaturedStoryReader
                story={openStory}
                me={{ uid: currentUser?.uid, name: profile?.fullName, country: profile?.country }}
                db={db}
                currentUser={currentUser}
                // Keep the Firestore-backed reflections; only the device-local half is
                // re-read. Resetting to loadLocalStories() alone dropped every remote one.
                onChanged={() => setFeaturedStories((prev) => [...prev.filter((s2) => s2.remote), ...loadLocalStories()])}
                onClose={() => setOpenStory(null)} />
            )}

            {showInstallBanner && deferredInstallRef.current && (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 14px", background: "rgba(210,67,65,0.1)",
                borderBottom: "1px solid rgba(210,67,65,0.15)", flexShrink: 0,
              }}>
                <span style={{ fontSize: 13, color: darkMode ? "rgba(255,255,255,0.8)" : "#0f172a" }}>
                  Install Seen for the best experience
                </span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button onClick={handleInstall} style={{
                    fontSize: 12, fontWeight: 600, color: "#D24341",
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
            <div data-tour="tab-nav" className="flex items-center justify-evenly border-b border-slate-100 bg-white flex-shrink-0">
              <button
                onClick={() => setActiveTab("feed")}
                className={`relative py-2.5 px-1 text-[12px] font-semibold transition-colors border-b-2 ${
                  activeTab === "feed"
                    ? "border-teal-500 text-teal-600"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}>
                🤝 Connect
                {feedUnreadCount > 0 && (
                  <span className="absolute top-0.5 -right-3 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-rose-500 px-1 text-[8px] font-bold text-white">
                    {feedUnreadCount > 99 ? "99+" : feedUnreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("hyt")}
                className={`py-2.5 px-1 text-[12px] font-semibold transition-colors border-b-2 ${
                  activeTab === "hyt"
                    ? "border-teal-500 text-teal-600"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}>
                🌱 Practice
              </button>
              <button
                onClick={() => setActiveTab("journal")}
                className={`py-2.5 px-1 text-[12px] font-semibold transition-colors border-b-2 ${
                  activeTab === "journal"
                    ? "border-teal-500 text-teal-600"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}>
                📓 Reflect
              </button>
              <button
                onClick={() => setActiveTab("impact")}
                className={`py-2.5 px-1 text-[12px] font-semibold transition-colors border-b-2 ${
                  activeTab === "impact"
                    ? "border-teal-500 text-teal-600"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}>
                🌳 Growth
              </button>
            </div>

            {/* Kindness loop — a rotating card of someone who could use encouragement right now
                (composing your own feeling lives by the header name + in your profile) */}
            {activeTab === "feed" && (
              <WorldwideBoard
                messages={messages}
                myUid={currentUser?.uid}
                focusedUids={focusedUids}
                blockedUids={blockedUids}
                moments={worldwideMoments}
                stories={worldwideStories}
                onOpenStory={(s) => setOpenStory(s)}
                onToggleFocus={toggleFocus}
                onReplyPrivately={(m) => setReplyTarget(m)} />
            )}

            {activeTab === "hyt" ? (
              <HaveYouTried currentUser={currentUser} dob={profile?.dob} />
            ) : activeTab === "journal" ? (
              <JournalPanel db={db} currentUser={currentUser} profile={profile} darkMode={darkMode} inline />
            ) : activeTab === "support" ? (
              <Suspense fallback={<div className="flex-1 flex items-center justify-center py-16"><Loader2 className="animate-spin text-teal-500" size={28} /></div>}>
                <Support country={profile?.country} />
              </Suspense>
            ) : activeTab === "impact" ? (
              <MySeenStory db={db} currentUser={currentUser} liveStats={liveImpact} streak={streak} profile={profile} sparkBalance={sparkBalance} darkMode={darkMode} onOpenTree={() => setShowLevels(true)} />
            ) : (
            <main ref={feedRef} className="flex-1 overflow-y-auto bg-slate-50/60 px-3.5 pt-2 pb-4"
              onClick={() => { setActiveMessageId(null); }}
              onScroll={handleFeedScroll}>
              {/* Floating date pill — appears while scrolling, fades out when idle.
                  height:0 so it overlays the feed instead of reserving vertical space.
                  Sits below the pinned Focused Feed header rather than under it. */}
              <div className="pointer-events-none" style={{ position: "sticky", top: 44, zIndex: 20, height: 0, textAlign: "center" }}>
                <span style={{
                  display: "inline-block",
                  opacity: feedDateVisible ? 1 : 0,
                  transition: "opacity 0.25s",
                  background: "rgba(0,0,0,0.42)",
                  color: "#fff",
                  borderRadius: 20,
                  padding: "3px 14px",
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: "0.01em",
                }}>
                  {feedDateLabel}
                </span>
              </div>
              {/* Shared journals and your own posts are no longer fixed strips here — they
                  flow inside whichever feed they belong to, in time order. */}
              {/* Transparent "Seen · official" welcome — shown to new users (before their first
                  send). NOT a fake human/account: a clearly-labelled system message that warms
                  the cold-start. Disappears once they send, or on dismiss. */}
              {!hasSent && !welcomeDismissed && (
                <div className="relative mb-3 rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-teal-50 p-3.5 pr-9"
                  style={{ animation: "seenFadeUp 400ms ease both" }}>
                  <button
                    onClick={() => { setWelcomeDismissed(true); try { localStorage.setItem("seen_welcome_dismissed", "1"); } catch { /* ignore */ } }}
                    aria-label="Dismiss welcome"
                    className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:bg-white/60 hover:text-slate-600">
                    <X size={13} />
                  </button>
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-emerald-400 text-white shadow-sm">
                      <Sparkles size={16} />
                    </div>
                    <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Seen · official</span>
                  </div>
                  <p className="mt-2 text-[13px] font-medium leading-relaxed text-slate-700">
                    Welcome to Seen 💛 — a little corner of the internet whose only job is kindness. Send your first greeting below, and someone, somewhere, will feel it.
                  </p>
                </div>
              )}
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
                    style={{ background: "linear-gradient(135deg, #0e1e30, #162d45)", border: "1px solid rgba(90,170,255,0.35)", boxShadow: "0 8px 24px rgba(0,0,0,0.25)", animation: "seenToastDown 0.35s ease both" }}
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
              {/* "💛 Sent" confirmation — the greeting appears at the top, so reassure by the composer */}
              {sentToast && (
                <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[250] flex justify-center px-4">
                  <div
                    className="flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white"
                    style={{ background: "linear-gradient(135deg, #FFAD6E, #FF9E57)", boxShadow: "0 8px 24px rgba(255,158,87,0.45)", animation: "seenQrbIn 320ms cubic-bezier(0.34, 1.56, 0.64, 1) both" }}>
                    <span className="text-base">💛</span> {sentToast}
                  </div>
                </div>
              )}
              {/* Reaction-from-country toast */}
              {reactionToast && (
                <div className="sticky z-30" style={{ top: "8px" }} onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setReactionToast(null); setShowMap(true); }}
                    className="w-full mb-4 flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left active:scale-[0.98] transition-all"
                    style={{ background: "linear-gradient(135deg, #3a2a05, #5a3d0a)", border: "1px solid rgba(255,179,71,0.45)", boxShadow: "0 8px 24px rgba(0,0,0,0.25)", animation: "seenToastDown 0.35s ease both" }}
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
                    style={{ background: "linear-gradient(135deg, #3B1A18, #4E211F)", border: "1px solid rgba(255,196,192,0.5)", boxShadow: "0 8px 24px rgba(0,0,0,0.25)", animation: "seenToastDown 0.35s ease both" }}
                  >
                    <span className="text-2xl">🏠</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm" style={{ color: "#FFC4C0" }}>
                        A neighbour just {REACTION_WORD[hometownToast.emoji] ? `sent you a ${REACTION_WORD[hometownToast.emoji]}` : "reacted"}!
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(255,196,192,0.7)" }}>
                        Someone from your own country felt your kindness {hometownToast.emoji}
                      </p>
                    </div>
                    <span
                      onClick={(e) => { e.stopPropagation(); setHometownToast(null); }}
                      className="p-1 flex-shrink-0"
                      style={{ color: "rgba(255,196,192,0.5)" }}
                    >✕</span>
                  </button>
                </div>
              )}
              {/* Kindness-chain toast — someone the user reached went on to greet others */}
              {rippleToast && (
                <div className="sticky z-30" style={{ top: "8px" }} onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setRippleToast(null); setShowMap(true); }}
                    className="w-full mb-4 flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left active:scale-[0.98] transition-all"
                    style={{ background: "linear-gradient(135deg, #451212, #5C1A19)", border: "1px solid rgba(255,133,128,0.45)", boxShadow: "0 8px 24px rgba(0,0,0,0.25)", animation: "seenToastDown 0.35s ease both" }}
                  >
                    <span className="text-2xl">🌱</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm" style={{ color: "#FFA09A" }}>
                        Kindness chain! Someone you reached{rippleToast.country ? ` in ${rippleToast.country}` : ""} just greeted someone else.
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "rgba(255,160,154,0.7)" }}>Your kindness is multiplying — watch the ripple →</p>
                    </div>
                    <span
                      onClick={(e) => { e.stopPropagation(); setRippleToast(null); }}
                      className="p-1 flex-shrink-0"
                      style={{ color: "rgba(255,160,154,0.5)" }}
                    >✕</span>
                  </button>
                </div>
              )}
              {/* The "help people see the person behind the kindness" card used to sit here.
                  It now arrives through the 🔔 bell after three days — see `nudges` below.
                  It was landing on day one, in the middle of the feed, before anyone had a
                  reason to care about their profile. */}
              {/* The wellbeing check-in prompt used to sit here. It was the app talking to you,
                  wearing the same clothes as a message from another person, in the one place
                  reserved for other people. Restyling it wouldn't have fixed that — it now
                  arrives through the 🔔 bell alongside every other app-to-user message. */}
              {/* Crisis-support banner — surfaced when something you have written in your own
                  words reads as distressed. Shows live helplines inline (not just a deep-link)
                  so a heavy moment never requires navigating away to find a number.

                  This used to watch your shared "feeling". That feature is gone, so it now
                  watches your own personal posts from the last day — the surface that replaced
                  it, and the only place you still write freely about yourself in the feed.
                  Dropping the check along with the feature would have quietly removed the one
                  automatic route to a helpline in the app. */}
              {DISTRESS_RE.test(recentOwnWriting) && (
                <div
                  className="seen-crisis-banner w-full mb-4 rounded-2xl px-4 py-3.5"
                  style={{ background: "linear-gradient(135deg, #fef2f2, #fce7f3)", border: "1px solid #fbcfe8" }}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0">🫂</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-800 text-sm">Sounds like a heavy moment — you're not alone</p>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                        Seen isn't a crisis service. If you need to talk to someone right now:
                      </p>
                      {/* Routes must match the user's country. A UK 999 shown to someone in
                          the US is worse than useless in the moment it matters most, so an
                          unknown country falls back to wording that works anywhere. */}
                      <div className="mt-2 flex flex-col gap-1.5 text-xs">
                        {crisisEmergency ? (
                          <a href={`tel:${crisisEmergency}`} className="font-bold text-red-600">🚨 In immediate danger? Call {crisisEmergency}</a>
                        ) : (
                          <span className="font-bold text-red-600">🚨 In immediate danger? Call your local emergency number</span>
                        )}
                        {crisisLines.map((r) => (
                          r.phone && /^[\d +]+$/.test(r.phone) ? (
                            <a key={r.name} href={`tel:${r.phone.replace(/\s/g, "")}`} className="font-semibold text-slate-700">
                              📞 {r.name} — {r.phone}{r.free ? " (free)" : ""}
                            </a>
                          ) : r.phone ? (
                            <span key={r.name} className="font-semibold text-slate-700">💬 {r.name} — {r.phone}</span>
                          ) : (
                            <a key={r.name} href={r.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-700">
                              🔗 {r.name}
                            </a>
                          )
                        ))}
                      </div>
                      <button onClick={(e) => { e.stopPropagation(); setActiveTab("support"); }}
                        className="mt-2 text-xs font-semibold text-teal-600">More support in Seen →</button>
                    </div>
                  </div>
                </div>
              )}
              {/* v2 Focused Feed: only people you follow (+ your own messages), plus the kind
                  moments involving them. Strangers live in the Worldwide Feed above. */}
              {(() => {
                const focusedSet = new Set(focusedUids);
                const focusedMsgs = messages.filter((m) => m.uid && !blockedUids.has(m.uid) && (focusedSet.has(m.uid) || m.uid === currentUser.uid));
                if (focusedMsgs.length === 0 && focusedMoments.length === 0 && focusedStories.length === 0 && localPosts.length === 0) return <FocusedFeedEmpty />;
                const grouped = [];
                focusedMsgs.forEach((m) => {
                  const last = grouped[grouped.length - 1];
                  const tsMs = typeof m.timestamp === "number" ? m.timestamp : Number(m.timestamp);
                  const mDay = m.timestamp ? new Date(tsMs).toDateString() : null;
                  const lastTsMs = last?.items[0]?.timestamp ? (typeof last.items[0].timestamp === "number" ? last.items[0].timestamp : Number(last.items[0].timestamp)) : null;
                  const lastDay = lastTsMs ? new Date(lastTsMs).toDateString() : null;
                  const sameDay = mDay === lastDay;
                  const sameSender = last?.uid === m.uid;
                  if (sameSender && sameDay) {
                    last.items.push(m);
                  } else {
                    grouped.push({ uid: m.uid, sender: m.sender, items: [m], dayLabel: formatDayLabel(m.timestamp), showDaySep: lastDay !== null && !sameDay });
                  }
                });
                // Everything that belongs to your people — messages, kind moments, shared
                // journals and your own posts — flows inline in time order, rather than
                // sitting in fixed blocks above the feed.
                const groupTs = (g) => Number(g.items[0]?.timestamp) || 0;
                const entries = [
                  ...grouped.map((g) => ({ kind: "group", ts: groupTs(g), key: g.items[0].id, group: g })),
                  ...focusedMoments.map((km) => ({ kind: "moment", ts: Number(km.ts) || 0, key: km.id, moment: km })),
                  ...focusedStories.map((s) => ({ kind: "story", ts: Number(s.ts) || 0, key: s.id, story: s })),
                  ...localPosts.map((p) => ({ kind: "post", ts: Number(p.timestamp) || 0, key: p.id, post: p })),
                ].sort((a, b) => b.ts - a.ts);
                return (
                  <>
                  <FocusedFeedHeader count={follows.length} onManage={() => setShowFollowing(true)} />
                  {entries.map((entry) => {
                  if (entry.kind === "moment") return <KindMomentCard key={entry.key} moment={entry.moment} />;
                  if (entry.kind === "story") return <SharedJournalCard key={entry.key} story={entry.story} onOpen={(s) => setOpenStory(s)} />;
                  if (entry.kind === "post") return <LocalPostCard key={entry.key} post={entry.post} onDelete={removeLocalPost} />;
                  const group = entry.group;
                  const mine = group.uid === currentUser.uid;
                  const isMulti = group.items.length > 1;
                  const firstId = group.items[0].id;
                  const isNewGroup = newMessageIds.has(firstId);
                  const groupLabel = followLabelByUid[group.uid];
                  return (
                    <React.Fragment key={firstId}>
                    {group.showDaySep && (
                      <div data-daylabel={group.dayLabel} className="flex items-center gap-3 my-1.5 select-none pointer-events-none">
                        <div className="flex-1 h-px bg-slate-200" />
                        <span className="text-[11px] font-medium text-slate-400 px-1">{group.dayLabel}</span>
                        <div className="flex-1 h-px bg-slate-200" />
                      </div>
                    )}
                    <MessageSlideIn mine={mine} isNew={isNewGroup}>
                      <div className="mb-0.5">
                        <div className="w-full group">
                          {/* Uncluttered header: name only — mood + country live in the glimpse card (tap the name). */}
                          <div className="flex items-center gap-1.5 px-1 mb-1 text-[10px] font-semibold text-slate-400">
                            {mine ? (
                              "You"
                            ) : (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setGlimpse({ uid: group.uid, country: group.items[0].country ?? null, name: group.sender }); }}
                                  className="font-semibold text-slate-500 hover:text-teal-600 active:text-teal-700 transition-colors">
                                  {group.sender}
                                </button>
                                {/* private label you gave them in "People you follow".
                                    Replying lives in the bubble's action bar (press a message). */}
                                {groupLabel && (
                                  <span className="rounded-full bg-teal-50 px-1.5 py-px text-[9px] font-bold text-teal-600">{groupLabel}</span>
                                )}
                              </>
                            )}
                          </div>
                          <div className="relative">
                            <div className="space-y-0.5">
                              {group.items.map((m, idx) => {
                                const isFirst = idx === 0;
                                const isLast = idx === group.items.length - 1;
                                const topRadius = isFirst ? "rounded-t-2xl" : "rounded-t-lg";
                                const botRadius = isLast ? "rounded-b-2xl" : "rounded-b-lg";
                                const tailClass = "";
                                const isActive = activeMessageId === m.id;
                                return (
                                  <div key={m.id} data-msg-id={m.id} className="relative pb-0.5">
                                    {/* WhatsApp-style reaction bar — floats above bubble on long press */}
                                    {reactionBarId === m.id && (
                                      <>
                                        <div className="seen-qrb-backdrop" onClick={(e) => { e.stopPropagation(); setReactionBarId(null); }} />
                                        <div className={`absolute z-30 ${mine ? "right-0" : "left-0"}`}
                                          style={reactionBarFlip ? { top: "calc(100% + 8px)" } : { bottom: "calc(100% + 8px)" }}>
                                          <QuickReactBar
                                            db={db} messageId={m.id} senderUid={m.uid} senderName={group.sender}
                                            currentUser={currentUser} profile={profile} mine={mine} isPremium={isPremium}
                                            onClose={() => setReactionBarId(null)}
                                            onWave={() => { triggerReactionBurst("👋"); anim.triggerWaveRipple(15, 70); haptic([6]); }}
                                            onGift={(emoji) => { triggerReactionBurst(emoji); haptic([6, 20, 6]); }}
                                            onReact={(emoji) => {
                                              triggerReactionBurst(emoji);
                                              haptic([5]);
                                              playHeart();
                                              if (emoji === "❤️" && !mine) setLocalHeartedMessageIds(prev => new Set([...prev, m.id]));
                                            }}
                                            onUpgrade={() => { if (!isNativeIOS()) setShowUpgrade(true); }}
                                            onReply={() => setReplyTarget(m)}
                                            onDelete={() => { handleDeleteMessage(m.id, m.sparkReward ?? 0); setReactionBarId(null); }}
                                          />
                                        </div>
                                      </>
                                    )}

                                    {/* Bubble — tap for timestamp, long-press for reaction bar */}
                                    <div
                                      data-tour={(!mine && reactionBarId === m.id) ? "connect" : undefined}
                                      className="relative select-none seen-noselect"
                                      onContextMenu={(e) => e.preventDefault()}
                                      onMouseDown={(e) => {
                                        longPressTriggered.current = false;
                                        const el = e.currentTarget;
                                        longPressTimer.current = setTimeout(() => {
                                          longPressTriggered.current = true;
                                          setReactionBarFlip(computeReactionFlip(el));
                                          setReactionBarId(m.id);
                                          setActiveMessageId(null);
                                          haptic([6, 30, 6]);
                                        }, 450);
                                      }}
                                      onMouseUp={() => clearTimeout(longPressTimer.current)}
                                      onMouseLeave={() => { clearTimeout(longPressTimer.current); longPressTriggered.current = false; }}
                                      onTouchStart={(e) => {
                                        const el = e.currentTarget;
                                        longPressTimer.current = setTimeout(() => {
                                          setReactionBarFlip(computeReactionFlip(el));
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
                                        setActiveMessageId(isActive ? null : m.id);
                                      }}>
                                      <div className="relative">
                                        {/* Bubble fill. Both sides are light tints of the sunset ramp rather
                                            than one white and one saturated coral — a solid fill at full
                                            saturation was the "too bright" the review flagged, and it also
                                            forced white body text, which is the harder of the two to read.
                                            Yours is the warmer tint (emerald-100 = #FFEAD8), theirs the
                                            cooler one (teal-50 = #FFF1F0), so the two are still telling
                                            apart at a glance without either shouting.

                                            Dark mode needs nothing here: index.css already remaps
                                            bg-teal-50 / bg-emerald-100 to low-alpha tints of the same hues,
                                            and the text-*-900 remaps sit next to them. */}
                                        <div
                                          className={`border px-3.5 py-2.5 text-[14px] font-semibold select-none ${topRadius} ${botRadius} ${tailClass} ${
                                            mine
                                              ? "bg-emerald-100 border-emerald-200 text-emerald-900"
                                              : "bg-teal-50 border-teal-200 text-teal-900"
                                          }`}>
                                          {m.text}
                                        </div>
                                        <ReactionSideBadges db={db} messageId={m.id} senderUid={m.uid} currentUser={currentUser} mine={mine} onReact={(e) => { triggerReactionBurst(e); playHeart(); }} onViewReactors={() => setReactorsFor(m)} reactorCountry={profile?.country} reactorName={profile?.fullName} lastGreetingAt={profile?.lastGreetingAt} localHearted={localHeartedMessageIds.has(m.id) && !mine} messageTs={m.timestamp} />
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
                    </React.Fragment>
                  );
                  })}
                  </>
                );
              })()}
              <SendingIndicator visible={isSending} />
            </main>
            )} {/* end activeTab === "feed" */}

            {/* First-time "tap to send" coach-mark — floats above the Send bar for brand-new
                users, never while the guided tour runs; vanishes on first send/tap. */}
            {activeTab === "feed" && !hasSent && !coachSeen && !tourActive && !pickerOpen && (
              <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[240] flex justify-center px-4">
                <div className="send-coach-hop flex flex-col items-center">
                  <div className="flex items-center gap-1.5 rounded-full bg-slate-900/90 px-3.5 py-2 text-[12px] font-semibold text-white shadow-lg">
                    👆 Tap to send your first kindness
                  </div>
                  <div style={{ width: 0, height: 0, borderLeft: "6px solid transparent", borderRight: "6px solid transparent", borderTop: "7px solid rgba(15,23,42,0.9)" }} />
                </div>
              </div>
            )}

            {/* FAB-style footer — only on feed tab */}
            {activeTab === "feed" && (
            <footer className="border-t border-slate-100 bg-white px-3 pt-2" style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
              {/* A failed send must be visible. This used to sit inside the !pickerOpen
                  branch below, but the picker is open at the moment you send — so a
                  rejected write showed nothing at all and then cleared itself. */}
              {sendError && (
                <p className="mb-2 text-center text-xs font-semibold text-red-500" role="alert">{sendError}</p>
              )}
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
                  <button
                    data-tour="send"
                    onClick={() => { setPickerOpen(true); markCoachSeen(); }}
                    disabled={isSending}
                    className={`w-full relative overflow-hidden rounded-xl py-2.5 text-[15px] font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.97] disabled:opacity-70${isSending ? "" : " send-kindness-pulse"}`}
                    style={{
                      background:
                        "linear-gradient(180deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 55%), linear-gradient(180deg, #FFAD6E 0%, #FF9E57 55%, #E07C33 100%)",
                      border: "1px solid rgba(224,124,51,0.55)",
                      boxShadow:
                        "inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -2px 6px rgba(184,95,29,0.45), 0 4px 16px rgba(255,158,87,0.45)",
                      textShadow: "0 1px 1px rgba(184,95,29,0.4)",
                    }}>
                    {!isSending && <span aria-hidden="true" className="send-kindness-shine" />}
                    {/* Just the words, centred. The ✨ glyph, the 🔥 streak-bonus chip and the
                        "N left" counter all used to ride along here. Between them they pushed
                        the label off-centre and turned the one button everything depends on
                        into a status readout. The streak bonus is still shown in the bell,
                        and the daily limit still announces itself when you actually reach it
                        (the branch above this one). */}
                    {isSending
                      ? <Loader2 size={16} className="text-white animate-spin" />
                      : <span>Send Message</span>}
                  </button>
                </>
              ) : null}
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
                  style={{ animation: "seenSheetRise 400ms cubic-bezier(0.34,1.56,0.64,1) both", paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}>
                  <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
                  {/* The picker covers the footer, so a failed send has to report itself
                      here — otherwise the only error message is behind this sheet. */}
                  {sendError && (
                    <p className="mb-2 rounded-xl bg-red-50 px-3 py-2 text-center text-xs font-semibold text-red-600" role="alert">
                      {sendError}
                    </p>
                  )}
                  <GreetingPicker
                    profile={profile}
                    streak={streak}
                    onSelect={handleSendMessage}
                    onClose={() => setPickerOpen(false)}
                    onUpgrade={() => { setPickerOpen(false); setShowUpgrade(true); }}
                    onPersonalShare={() => { setPickerOpen(false); setPostComposerOpen(true); }}
                    isSending={isSending}
                    remainingToday={DAILY_GREETING_LIMIT - todayMessageCount}
                    db={db}
                    currentUser={currentUser}
                    communityGreetings={champions}
                  />
                </div>
              </div>
            )}

            {/* ── First-time guided spotlight tour ── */}
            {/* Never render over the post-onboarding "Let's go" welcome overlay — otherwise the
                tour spotlight targets feed elements that are hidden behind it (out of sync). */}
            {/* v2: guided tour retired (coach-marks teach in context instead) */}

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

            {/* ── Admin: confirm full-reset modal ── */}
            {adminResetConfirm && (
              <div className="absolute inset-0 z-50 flex items-center justify-center p-6" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
                <div className="w-full max-w-xs rounded-3xl bg-white p-6 shadow-2xl">
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                      <Shield size={22} className="text-red-600" />
                    </div>
                    <p className="font-bold text-slate-800 text-base">Full app reset?</p>
                    <p className="text-sm text-slate-500">Permanently deletes all messages, reactions, waves, presence, and reports. User accounts are kept. This cannot be undone.</p>
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
