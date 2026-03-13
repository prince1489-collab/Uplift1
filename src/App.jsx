import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Calendar,
  ChevronDown,
  Globe,
  Loader2,
  Mail,
  LogOut,
  Send,
  Sparkles,
  Gift,
  User,
} from "lucide-react";

import ProfilePhotoStep from "./ProfilePhotoStep";
import SignInStep from "./SignInStep";
import WelcomeStep from "./WelcomeStep";

import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signOut,
  signInWithPopup,
  signInWithRedirect,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
} from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBSez1kAaFXKZzM97E9y4HhDiqE3tRAeLE",
  authDomain: "uplift-6d9ea.firebaseapp.com",
  projectId: "uplift-6d9ea",
  storageBucket: "uplift-6d9ea.appspot.com",
  messagingSenderId: "821891105119",
  appId: "1:821891105119:web:6245f2bc4c8c8ee96976ea",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = import.meta.env.VITE_APP_ID || firebaseConfig.projectId;
const googleProvider = new GoogleAuthProvider();

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const YEARS = Array.from({ length: 100 }, (_, i) => String(new Date().getFullYear() - i));

const COUNTRY_OPTIONS = [
  "Afghanistan",
  "Albania",
  "Algeria",
  "Andorra",
  "Angola",
  "Antigua and Barbuda",
  "Argentina",
  "Armenia",
  "Australia",
  "Austria",
  "Azerbaijan",
  "Bahamas",
  "Bahrain",
  "Bangladesh",
  "Barbados",
  "Belarus",
  "Belgium",
  "Belize",
  "Benin",
  "Bhutan",
  "Bolivia",
  "Bosnia and Herzegovina",
  "Botswana",
  "Brazil",
  "Brunei",
  "Bulgaria",
  "Burkina Faso",
  "Burundi",
  "Cabo Verde",
  "Cambodia",
  "Cameroon",
  "Canada",
  "Central African Republic",
  "Chad",
  "Chile",
  "China",
  "Colombia",
  "Comoros",
  "Congo",
  "Costa Rica",
  "Croatia",
  "Cuba",
  "Cyprus",
  "Czech Republic",
  "Democratic Republic of the Congo",
  "Denmark",
  "Djibouti",
  "Dominica",
  "Dominican Republic",
  "Ecuador",
  "Egypt",
  "El Salvador",
  "Equatorial Guinea",
  "Eritrea",
  "Estonia",
  "Eswatini",
  "Ethiopia",
  "Fiji",
  "Finland",
  "France",
  "Gabon",
  "Gambia",
  "Georgia",
  "Germany",
  "Ghana",
  "Greece",
  "Grenada",
  "Guatemala",
  "Guinea",
  "Guinea-Bissau",
  "Guyana",
  "Haiti",
  "Honduras",
  "Hungary",
  "Iceland",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Ireland",
  "Israel",
  "Italy",
  "Ivory Coast",
  "Jamaica",
  "Japan",
  "Jordan",
  "Kazakhstan",
  "Kenya",
  "Kiribati",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Latvia",
  "Lebanon",
  "Lesotho",
  "Liberia",
  "Libya",
  "Liechtenstein",
  "Lithuania",
  "Luxembourg",
  "Madagascar",
  "Malawi",
  "Malaysia",
  "Maldives",
  "Mali",
  "Malta",
  "Marshall Islands",
  "Mauritania",
  "Mauritius",
  "Mexico",
  "Micronesia",
  "Moldova",
  "Monaco",
  "Mongolia",
  "Montenegro",
  "Morocco",
  "Mozambique",
  "Myanmar",
  "Namibia",
  "Nauru",
  "Nepal",
  "Netherlands",
  "New Zealand",
  "Nicaragua",
  "Niger",
  "Nigeria",
  "North Korea",
  "North Macedonia",
  "Norway",
  "Oman",
  "Pakistan",
  "Palau",
  "Palestine",
  "Panama",
  "Papua New Guinea",
  "Paraguay",
  "Peru",
  "Philippines",
  "Poland",
  "Portugal",
  "Qatar",
  "Romania",
  "Russia",
  "Rwanda",
  "Saint Kitts and Nevis",
  "Saint Lucia",
  "Saint Vincent and the Grenadines",
  "Samoa",
  "San Marino",
  "Sao Tome and Principe",
  "Saudi Arabia",
  "Senegal",
  "Serbia",
  "Seychelles",
  "Sierra Leone",
  "Singapore",
  "Slovakia",
  "Slovenia",
  "Solomon Islands",
  "Somalia",
  "South Africa",
  "South Korea",
  "South Sudan",
  "Spain",
  "Sri Lanka",
  "Sudan",
  "Suriname",
  "Sweden",
  "Switzerland",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Tanzania",
  "Thailand",
  "Timor-Leste",
  "Togo",
  "Tonga",
  "Trinidad and Tobago",
  "Tunisia",
  "Turkey",
  "Turkmenistan",
  "Tuvalu",
  "Uganda",
  "Ukraine",
  "United Arab Emirates",
  "United Kingdom",
  "United States",
  "Uruguay",
  "Uzbekistan",
  "Vanuatu",
  "Vatican City",
  "Venezuela",
  "Vietnam",
  "Yemen",
  "Zambia",
  "Zimbabwe",
];

const GREETINGS = [
  { id: "morning", text: "Good Morning, have a nice day! ☀️", sparkReward: 10, isMystery: false },
  { id: "afternoon", text: "Good Afternoon, hope you are doing great! 💛", sparkReward: 10, isMystery: false },
  { id: "night", text: "Good Night! Sleep well 🌙", sparkReward: 10, isMystery: false },
  { id: "mystery", text: "🎁 Mystery Greeting", sparkReward: 25, isMystery: true },
];

const LEVEL_THRESHOLDS = [
  { min: 0, title: "Novice Greeter" },
  { min: 50, title: "Kindness Scout" },
  { min: 150, title: "Beacon of Hope" },
  { min: 300, title: "Sunshine Bringer" },
  { min: 600, title: "Guardian of Joy" },
];

const nowMs = () => Date.now();
const toEmailKey = (email) => email.trim().toLowerCase();

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

function Onboarding({ onContinue, loading, initialData = null, errorMessage = "", initialEmail = "" }) {
  const [form, setForm] = useState({
    country: "",
    fullName: "",
    email: "",
    dobMonth: "",
    dobDay: "",
    dobYear: "",
  });

    useEffect(() => {
    const [dobMonth = "", dobDay = "", dobYear = ""] = (initialData?.dob || "").replace(",", "").split(" ");

     // eslint-disable-next-line react-hooks/set-state-in-effect
    setForm((prev) => ({
      ...prev,
      country: initialData?.country || "",
      fullName: initialData?.fullName || "",
      email: initialEmail || initialData?.email || "",
      dobMonth,
      dobDay,
      dobYear,
   }));
  }, [initialData, initialEmail]);
  const valid =
    Boolean(form.country) &&
    Boolean(form.fullName) &&
    Boolean(form.email) &&
    Boolean(form.dobMonth) &&
    Boolean(form.dobDay) &&
    Boolean(form.dobYear)

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-600" />
      </div>
    );
  }

  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <div className="h-full w-full bg-gradient-to-b from-[#edf5f6] via-[#f7f7f6] to-[#f6f5f2] px-6 pt-8 pb-6">
      <form
        className="mx-auto w-full max-w-sm space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;

          onContinue({
            ...form,
            dob: `${form.dobMonth} ${form.dobDay}, ${form.dobYear}`,
          });
        }}
      >
        <div className="flex justify-center gap-2 pb-3">
          <span className="h-2 w-8 rounded-full bg-teal-500" />
          <span className="h-2 w-8 rounded-full bg-slate-300" />
        </div>

        <div className="flex justify-center pb-3">
          <div className="rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-400 p-4 text-white shadow-md">
            <Sparkles size={24} />
          </div>
        </div>

        <h1 className="text-center text-[42px] leading-[1.05] font-extrabold tracking-[-0.02em] text-slate-800 sm:text-[44px]">
          Welcome to Uplift
        </h1>
        <p className="pb-4 text-center text-[22px] leading-tight text-slate-500 sm:text-2xl">
          Tell us a bit about yourself to start connecting.
        </p>

        <InputRow
          icon={Globe}
          rightIcon={<ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />}
        >
          <select
            name="country"
            value={form.country}
            onChange={onChange}
            className="w-full appearance-none rounded-2xl border border-slate-300 bg-slate-50 py-3.5 pr-10 pl-11 text-base text-slate-500"
          >
            <option value="">Select Country</option>
            {COUNTRY_OPTIONS.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </InputRow>

        <InputRow icon={User}>
          <input
            name="fullName"
            value={form.fullName}
            onChange={onChange}
            placeholder="Full Name"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pr-3 pl-11 text-base text-slate-700 placeholder:text-slate-400"
          />
        </InputRow>

        <InputRow icon={Mail}>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={onChange}
            placeholder="Email Address"
            readOnly={Boolean(initialEmail)}
            className={`w-full rounded-2xl border border-slate-200 py-3.5 pr-3 pl-11 text-base text-slate-700 placeholder:text-slate-400 ${initialEmail ? "bg-slate-100" : "bg-slate-50"}`}
          />
        </InputRow>

        {errorMessage ? <p className="px-1 text-sm text-rose-600">{errorMessage}</p> : null}

        <div className="rounded-2xl border border-slate-300 bg-slate-100/80 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold tracking-[0.08em] text-slate-500 uppercase">
            <Calendar size={13} />
            <span>Date of Birth</span>
          </div>

          <div className="grid grid-cols-3 gap-2">
          <div className="relative">
            <select
              name="dobMonth"
              value={form.dobMonth}
              onChange={onChange}
              aria-label="Date of birth month"
              className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-2.5 pr-8 pl-3 text-sm text-slate-700"
            >
              <option value="">Month</option>
              {MONTHS.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          </div>

          <div className="relative">
            <select
              name="dobDay"
              value={form.dobDay}
              onChange={onChange}
              aria-label="Date of birth day"
               className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-2.5 pr-8 pl-3 text-sm text-slate-700"
            >
              <option value="">Day</option>
              {DAYS.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
             <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          </div>

          <div className="relative">
            <select
              name="dobYear"
              value={form.dobYear}
              onChange={onChange}
              aria-label="Date of birth year"
             className="w-full appearance-none rounded-xl border border-slate-300 bg-white py-2.5 pr-8 pl-3 text-sm text-slate-700"
            >
              <option value="">Year</option>
              {YEARS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={!valid}
          className={`mt-2 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-xl font-semibold text-white transition-colors ${
            valid ? "bg-teal-600 hover:bg-teal-700" : "bg-slate-400"
          } disabled:cursor-not-allowed disabled:opacity-100`}
        >
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

        <button
          type="button"
          onClick={onClose}
          className="mt-6 w-full rounded-2xl bg-teal-600 px-4 py-3 font-semibold text-white transition hover:bg-teal-700"
        >
          Awesome!
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [messages, setMessages] = useState([]);
  const [isChatLive, setIsChatLive] = useState(false);
  const [chatError, setChatError] = useState("");
  const [lastLiveAt, setLastLiveAt] = useState(null);
  const [chatRetryCount, setChatRetryCount] = useState(0);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState("entry");
  const [pendingProfileData, setPendingProfileData] = useState(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [isSendingEmailLink, setIsSendingEmailLink] = useState(false);
  const [emailLinkMessage, setEmailLinkMessage] = useState("");
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [googleSignInError, setGoogleSignInError] = useState("");
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState("");
  const [onboardingError, setOnboardingError] = useState("");
  const [unauthScreen, setUnauthScreen] = useState("welcome");
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [mysteryReward, setMysteryReward] = useState(0);
  const endRef = useRef(null);
  const isRealSignedInUser = Boolean(currentUser && !currentUser.isAnonymous);
  
  useEffect(() => {
    let profileUnsub = null;
    
    const unsub = onAuthStateChanged(auth, (user) => {
      if (profileUnsub) {
        profileUnsub();
        profileUnsub = null;
      }
      
      setCurrentUser(user);
      setIsAuthLoading(false);
      setProfileLoadError("");
      if (!user || user.isAnonymous) {
        setProfile(null);
        setHasCompletedOnboarding(false);
        setOnboardingStep("entry");
        setUnauthScreen("welcome");
        setOnboardingError("");
        setIsProfileLoading(false);
        return;
      }
      
      const profileRef = doc(db, "artifacts", appId, "users", user.uid, "data", "profile");
      setIsProfileLoading(true);
     profileUnsub = onSnapshot(
        profileRef,
        (snap) => {
          const nextProfile = snap.exists() ? snap.data() : null;
          setProfile(nextProfile);
          setHasCompletedOnboarding(Boolean(nextProfile?.onboardingCompletedAt));
          if (nextProfile?.onboardingCompletedAt) {
            setOnboardingStep("done");
          } else {
            setOnboardingStep("details");
          }
          setProfileLoadError("");
          setIsProfileLoading(false);
        },
        (error) => {
          console.error("Unable to load profile", error);
          setProfile(null);
          setHasCompletedOnboarding(false);
          setOnboardingStep("entry");
          setProfileLoadError(error?.code || "unknown");
          setIsProfileLoading(false);
        }
      );
    });

    return () => {
      if (profileUnsub) profileUnsub();
      unsub();
    };
  }, []);



  useEffect(() => {
    const completeEmailLinkSignIn = async () => {
      if (!isSignInWithEmailLink(auth, window.location.href)) return;

      let email = window.localStorage.getItem("upliftEmailForSignIn");

      if (!email) {
        email = window.prompt("Please confirm your email address to complete sign-in.");
      }

      if (!email) return;

      try {
        setIsAuthLoading(true);
        await signInWithEmailLink(auth, email, window.location.href);
        window.localStorage.removeItem("upliftEmailForSignIn");
        setEmailLinkMessage("");
        setOnboardingError("");
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (error) {
        console.error("Unable to complete email link sign-in", error);
        setOnboardingError("Your sign-in link is invalid or expired. Please request a new one.");
      } finally {
        setIsAuthLoading(false);
      }
    };

    completeEmailLinkSignIn();
  }, []);

  const sendEmailSignInLink = async (email) => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      return "Please enter your email address.";
    }

    setIsSendingEmailLink(true);
    setEmailLinkMessage("");
    setGoogleSignInError("");

    try {
      const actionCodeSettings = {
        url: window.location.origin,
        handleCodeInApp: true,
      };

      await sendSignInLinkToEmail(auth, normalizedEmail, actionCodeSettings);
      window.localStorage.setItem("upliftEmailForSignIn", normalizedEmail);
      setEmailLinkMessage(`We sent a sign-in link to ${normalizedEmail}. Check your inbox.`);
      return "";
    } catch (error) {
      console.error("Unable to send email sign-in link", error);

      if (error?.code === "auth/invalid-email") {
        return "That email address is invalid.";
      }

      if (error?.code === "auth/operation-not-allowed") {
        return "Email link sign-in is disabled in Firebase. Enable Email/Password and Email link in Authentication.";
      }

      return "Unable to send the sign-in link right now. Please try again.";
    } finally {
      setIsSendingEmailLink(false);
    }
  };
  
  const signInWithGoogle = async () => {
    setIsGoogleSigningIn(true);
    setGoogleSignInError("");
    setEmailLinkMessage("");
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
       if (error?.code === "auth/popup-blocked" || error?.code === "auth/cancelled-popup-request") {
        await signInWithRedirect(auth, googleProvider);
        return;
      }

        if (error?.code === "auth/unauthorized-domain") {
        const currentDomain = window.location.hostname;
        setGoogleSignInError(`This domain (${currentDomain}) is not allowed in Firebase Auth. Add it under Authentication > Settings > Authorized domains.`);
      } else if (error?.code === "auth/operation-not-allowed") {
        setGoogleSignInError("Google sign-in is disabled for this Firebase project. Enable it under Authentication > Sign-in method.");
      } else {
        setGoogleSignInError("Google sign-in failed. Check Firebase Auth settings and try again.");
      }
      console.error(error);
    } finally {
      setIsGoogleSigningIn(false);
    }
  };
  
  useEffect(() => {
    if (!currentUser || currentUser.isAnonymous) return;
    let retryTimer = null;
    
    const q = query(
      collection(db, "artifacts", appId, "public", "data", "messages"),
      orderBy("timestamp", "asc"),
      limit(100)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const live = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMessages(
          live.length
            ? live
            : [
                {
                  id: "welcome",
                  sender: "Uplift Bot",
                  text: "Welcome! Chat is live and ready ✨",
                  uid: "system",
                  timestamp: Date.now(),
                },
              ]
        );
        setIsChatLive(true);
        setChatError("");
        setLastLiveAt(new Date());
      },
      (error) => {
        console.error("Live chat disconnected", error);
        setIsChatLive(false);
        setChatError(error?.code || "unknown");

        retryTimer = setTimeout(() => {
          setChatRetryCount((count) => count + 1);
        }, 3000);
      }
    );

     return () => {
      if (retryTimer) clearTimeout(retryTimer);
      unsub();
    };
  }, [currentUser, chatRetryCount]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const chatStatusText = useMemo(() => {
    if (!isChatLive) return "Reconnecting chat...";
    return "Live chat connected";
  }, [isChatLive]);

  const sparkBalance = Number(profile?.sparkBalance ?? profile?.sparks ?? 0);
  const currentLevel = useMemo(() => {
    return LEVEL_THRESHOLDS.reduce((level, threshold) => {
      if (sparkBalance >= threshold.min) return threshold;
      return level;
    }, LEVEL_THRESHOLDS[0]);
  }, [sparkBalance]);

  const nextLevel = useMemo(() => {
    return LEVEL_THRESHOLDS.find((threshold) => threshold.min > sparkBalance) || null;
  }, [sparkBalance]);

  const progressPercent = useMemo(() => {
    if (!nextLevel) return 100;
    const span = nextLevel.min - currentLevel.min;
    if (span <= 0) return 100;
    const completed = sparkBalance - currentLevel.min;
    return Math.max(0, Math.min(100, Math.round((completed / span) * 100)));
  }, [currentLevel.min, nextLevel, sparkBalance]);
  
   const handleSignOut = async () => {
    if (isSigningOut) return;

    try {
      setIsSigningOut(true);
      await signOut(auth);
      setPickerOpen(false);
    } catch (error) {
      console.error("Unable to sign out", error);
    } finally {
      setIsSigningOut(false);
    }
  };

    const signInExistingUser = async (email) => {
    return await sendEmailSignInLink(email);
  };

  const completeOnboarding = async (data) => {
    setOnboardingError("");
    setIsSavingProfile(true);

    try {
      const user = auth.currentUser;

      if (!user || user.isAnonymous) {
        setOnboardingError("Please sign in before continuing.");
        return;
      }

      if (!user.email) {
        setOnboardingError("We could not verify your account email. Please sign in again.");
        return;
      }

      const normalizedEmail = user.email.trim().toLowerCase();
      const emailKey = toEmailKey(normalizedEmail);
      const profileRef = doc(db, "artifacts", appId, "users", user.uid, "data", "profile");
      const profileIndexRef = doc(db, "artifacts", appId, "public", "data", "userProfiles", emailKey);
      const profileData = {
        ...data,
        email: normalizedEmail,
        emailKey,
        ownerUid: user.uid,
        onboardingCompletedAt: nowMs(),
      };

      await runTransaction(db, async (transaction) => {
        const indexedProfile = await transaction.get(profileIndexRef);

        if (indexedProfile.exists()) {
          const indexData = indexedProfile.data();
          const indexedOwner = indexData.ownerUid || indexData.userUid || indexData.uid || null;

          if (!indexedOwner || indexedOwner !== user.uid) {
            throw new Error("EMAIL_ALREADY_USED");
          }
        }

        transaction.set(profileRef, profileData);
        transaction.set(profileIndexRef, profileData);
      });

      await addDoc(collection(db, "artifacts", appId, "public", "data", "messages"), {
        uid: "system",
        sender: "Uplift Bot",
        text: `${data.fullName} just joined Uplift 👋`,
        timestamp: nowMs(),
      });

      setProfile(profileData);
      setHasCompletedOnboarding(true);
      setOnboardingStep("done");
      setPendingProfileData(null);
      } catch (error) {
      if (error?.message === "EMAIL_ALREADY_USED") {
        setOnboardingError("That email address is already in use. Please use a different email.");
        return;
      }

      if (error?.code === "permission-denied") {
        setOnboardingError(
          "Your account could not be saved because Firestore permissions are blocking profile writes. Update your Firebase Security Rules and try again."
        );
        return;
      }

      if (error?.code === "unavailable") {
        setOnboardingError("Firebase is temporarily unavailable. Please check your connection and try again.");
        return;
      }

      if (error?.code === "failed-precondition") {
        setOnboardingError(
          "Your profile could not be saved because Firebase is not fully configured yet. Verify Firestore indexes/rules, then retry."
        );
        return;
      }

      console.error("Unable to complete onboarding", error);
      setOnboardingError("Unable to save your profile right now. Please try again.");  
    } finally {
      setIsSavingProfile(false);
    }
  };

  const validateEmailBeforeNextStep = async (email) => {
    const authEmail = currentUser?.email?.trim().toLowerCase() || "";
    const normalizedEmail = authEmail || email.trim().toLowerCase();
    const emailKey = toEmailKey(normalizedEmail);
    const profileIndexRef = doc(db, "artifacts", appId, "public", "data", "userProfiles", emailKey);
    const indexedProfile = await getDoc(profileIndexRef);

    if (!indexedProfile.exists()) {
      return true;
    }

    const indexData = indexedProfile.data();
    const indexedOwner = indexData.ownerUid || indexData.userUid || indexData.uid || null;
    return Boolean(indexedOwner && currentUser && indexedOwner === currentUser.uid);
  };
  
  const startNewUserFlow = () => {
    setOnboardingStep("details");
    setUnauthScreen("signin");
    setOnboardingError("");
    setEmailLinkMessage("");
  };

  const handleSendMessage = async (greeting) => {
    if (!currentUser || !profile) return;

    await addDoc(collection(db, "artifacts", appId, "public", "data", "messages"), {
      uid: currentUser.uid,
      sender: profile.fullName,
      text: greeting.text,
      timestamp: nowMs(),
    });

     const reward = Number(greeting.sparkReward || 0);
    const profileRef = doc(db, "artifacts", appId, "users", currentUser.uid, "data", "profile");
    const profileIndexRef = doc(db, "artifacts", appId, "public", "data", "userProfiles", toEmailKey(profile.email));

      await runTransaction(db, async (transaction) => {
      const profileSnap = await transaction.get(profileRef);
      const profileData = profileSnap.exists() ? profileSnap.data() : {};
      const currentBalance = Number(profileData?.sparkBalance ?? profileData?.sparks ?? 0);
      const nextBalance = currentBalance + reward;

        transaction.set(
        profileRef,
        {
          sparkBalance: nextBalance,
          lastGreetingAt: nowMs(),
          ...(greeting.isMystery ? { lastMysteryGiftAt: nowMs() } : {}),
        },
        { merge: true }
      );

      transaction.set(
        profileIndexRef,
        {
          sparkBalance: nextBalance,
          lastGreetingAt: nowMs(),
          ...(greeting.isMystery ? { lastMysteryGiftAt: nowMs() } : {}),
        },
        { merge: true }
      );
    });

    if (greeting.isMystery) {
      setMysteryReward(reward);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setShowGiftModal(true);
    }
    
    setPickerOpen(false);
  };

  if (isAuthLoading || (isRealSignedInUser && isProfileLoading)) {
    return (
      <div className="grid h-screen place-items-center bg-slate-50">
        <Loader2 className="animate-spin text-teal-600" />
      </div>
    );
  }
  if (!isRealSignedInUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-teal-50 to-cyan-100 p-2 sm:p-6">
        <div className="relative flex h-[100dvh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-white/80 bg-white/95 shadow-2xl backdrop-blur sm:h-[90vh]">
          {unauthScreen === "welcome" ? (
            <WelcomeStep onStartJourney={() => setUnauthScreen("signin")} />
          ) : (
            <SignInStep
              onExistingSignIn={signInExistingUser}
              onStartNewUser={startNewUserFlow}
              loading={isSendingEmailLink}
              onGoogleSignIn={signInWithGoogle}
              googleLoading={isGoogleSigningIn}
              googleError={googleSignInError}
              emailLinkMessage={emailLinkMessage}
            />
          )}
        </div>
      </div>
    );
  }

  const firstName = profile?.fullName?.trim()?.split(" ")?.[0] || "there";
  
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-teal-50 to-cyan-100 p-2 sm:p-6">
      <div className="relative flex h-[100dvh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-white/80 bg-white/95 shadow-2xl backdrop-blur sm:h-[90vh]">
        <MysteryGiftModal open={showGiftModal} reward={mysteryReward} onClose={() => setShowGiftModal(false)} />
        {!hasCompletedOnboarding || !profile ? (
          <>
            {profileLoadError ? (
              <p className="mx-4 mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                We couldn&apos;t read your profile yet ({profileLoadError}). Please check your Firestore rules for
                <code className="mx-1 rounded bg-amber-100 px-1">artifacts/{appId}/users/{currentUser.uid}/data/profile</code>
                and refresh.
              </p>
            ) : null}
            {onboardingStep === "entry" ? (
              <SignInStep
                onExistingSignIn={signInExistingUser}
                onStartNewUser={startNewUserFlow}
                loading={isSendingEmailLink}
                onGoogleSignIn={signInWithGoogle}
                googleLoading={isGoogleSigningIn}
                googleError={googleSignInError}
                emailLinkMessage={emailLinkMessage}
              />
            ) : onboardingStep === "details" ? (
              <Onboarding
                onContinue={async (data) => {
                  setOnboardingError("");

                   try {
                    setIsCheckingEmail(true);
                    const canProceed = await validateEmailBeforeNextStep(data.email);

                    if (!canProceed) {
                      setOnboardingError("That email address is already in use. Please use a different email.");
                      return;
                    }
                  } catch (error) {
                    console.error("Unable to validate email", error);
                    setOnboardingError("Unable to validate your email right now. Please try again.");
                    return;
                  } finally {
                    setIsCheckingEmail(false);
                  }

                  setPendingProfileData(data);
                  setOnboardingStep("photo");
                }}
                loading={isSavingProfile || isCheckingEmail}
                initialData={pendingProfileData}
                initialEmail={currentUser?.email || ""}
                errorMessage={onboardingError}
              />
            ) : (
              <ProfilePhotoStep
                onBack={() => setOnboardingStep("details")}
                onComplete={(photoDataUrl) => completeOnboarding({ ...pendingProfileData, profilePhoto: photoDataUrl })}
                loading={isSavingProfile}
                initialPhoto={pendingProfileData?.profilePhoto || ""}
              />
            )}
          </>
        ) : (
          <>
            <header className="border-b border-slate-100 bg-white/90 px-4 py-3 backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-sm font-bold text-slate-800">Hey {firstName} 👋</h1>
                  <p className="text-xs text-slate-500">Spread kind greetings in real time</p>
                </div>
               <div className="flex items-center gap-2">
                  <Sparkles className="text-teal-500" size={18} />
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label="Sign out"
                  >
                    <LogOut size={12} />
                    {isSigningOut ? "Signing out..." : "Sign out"}
                  </button>
                </div>
              </div>

               <div className="mt-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold text-slate-800">{currentLevel.title}</p>
                    <p className="text-[11px] text-slate-500">
                      {nextLevel ? `${sparkBalance} / ${nextLevel.min} Sparks` : `${sparkBalance} Sparks`}
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                    <Sparkles size={12} />
                    {sparkBalance}
                  </div>
                </div>

                <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${progressPercent}%` }} />
                </div>
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px]">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold ${
                    isChatLive ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isChatLive ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                    }`}
                  />
                  {chatStatusText}
                </span>

                {lastLiveAt && (
                  <span className="text-slate-400">
                    Updated {lastLiveAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                )}
              </div>

              {!isChatLive && chatError ? (
                <p className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-800">
                  Chat is offline ({chatError}). Check Firestore rules for
                  <code className="mx-1 rounded bg-amber-100 px-1">artifacts/{appId}/public/data/messages</code>
                  and make sure your internet connection is stable.
                </p>
              ) : null}
            </header>

            <main className="flex-1 overflow-y-auto bg-slate-50/60 p-4">
              {messages.map((m) => {
                const mine = m.uid === currentUser.uid;
                return (
                  <div key={m.id} className={`mb-3 flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[82%] rounded-2xl border px-3 py-2 text-sm ${
                        mine
                          ? "rounded-br-none border-teal-600 bg-teal-600 text-white"
                          : "rounded-bl-none border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      <div className={`mb-1 text-[10px] font-semibold ${mine ? "text-teal-100" : "text-slate-400"}`}>
                        {m.sender}
                      </div>
                      <p>{m.text}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </main>

            <footer className="border-t border-slate-100 bg-white p-3">
              {!pickerOpen ? (
                <button
                  onClick={() => setPickerOpen(true)}
                  className="flex w-full items-center justify-between rounded-2xl bg-slate-100 px-4 py-3 text-slate-600"
                >
                  <span>Select a greeting...</span>
                  <span className="rounded-full bg-teal-500 p-2 text-white">
                    <Send size={14} />
                  </span>
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-slate-400">Choose Message</span>
                    <button onClick={() => setPickerOpen(false)} className="rounded-full bg-slate-100 p-1">
                      <ChevronDown size={16} className="text-slate-500" />
                    </button>
                  </div>

                  {GREETINGS.map((greeting) => (
                    <button
                      key={greeting.id}
                      onClick={() => handleSendMessage(greeting)}
                      className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left text-sm font-medium text-slate-700 hover:border-teal-400"
                    >
                      <span>{greeting.text}</span>
                      <span className="ml-2 text-xs text-teal-600">+{greeting.sparkReward} sparks</span>
                    </button>
                  ))}
                </div>
              )}
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
