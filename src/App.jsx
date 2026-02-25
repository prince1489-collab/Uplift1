import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Globe,
  Loader2,
  Mail,
  Send,
  Sparkles,
  User,
} from "lucide-react";

import ProfilePhotoStep from "./ProfilePhotoStep";
import SignInStep from "./SignInStep";

import { initializeApp } from "firebase/app";
import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup } from "firebase/auth";
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
  setDoc,
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
  { id: "morning", text: "Good Morning, have a nice day! ☀️" },
  { id: "afternoon", text: "Good Afternoon, hope you are doing great! 💛" },
  { id: "night", text: "Good Night! Sleep well 🌙" },
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

function Onboarding({ onContinue, loading, initialData = null }) {
  const [form, setForm] = useState({
    country: "",
    fullName: "",
    email: "",
    dobMonth: "",
    dobDay: "",
    dobYear: "",
  });

    useEffect(() => {
    if (!initialData) return;

    const [dobMonth = "", dobDay = "", dobYear = ""] = (initialData.dob || "").replace(",", "").split(" ");

    // eslint-disable-next-line react-hooks/set-state-in-effect  
    setForm({
      country: initialData.country || "",
      fullName: initialData.fullName || "",
      email: initialData.email || "",
      dobMonth,
      dobDay,
      dobYear,
    });
  }, [initialData]);
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
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pr-3 pl-11 text-base text-slate-700 placeholder:text-slate-400"
          />
        </InputRow>

        <div className="grid grid-cols-3 gap-2">
          <div className="relative">
            <select
              name="dobMonth"
              value={form.dobMonth}
              onChange={onChange}
              aria-label="Date of birth month"
              className="w-full appearance-none rounded-2xl border border-slate-300 bg-slate-50 py-3.5 pr-8 pl-3 text-base text-slate-700"
            >
              <option value="">Month</option>
              {MONTHS.map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          </div>

          <div className="relative">
            <select
              name="dobDay"
              value={form.dobDay}
              onChange={onChange}
              aria-label="Date of birth day"
              className="w-full appearance-none rounded-2xl border border-slate-300 bg-slate-50 py-3.5 pr-8 pl-3 text-base text-slate-700"
            >
              <option value="">Day</option>
              {DAYS.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          </div>

          <div className="relative">
            <select
              name="dobYear"
              value={form.dobYear}
              onChange={onChange}
              aria-label="Date of birth year"
              className="w-full appearance-none rounded-2xl border border-slate-300 bg-slate-50 py-3.5 pr-8 pl-3 text-base text-slate-700"
            >
              <option value="">Year</option>
              {YEARS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
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
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(true);
  const [isGoogleSigningIn, setIsGoogleSigningIn] = useState(false);
  const [profileLoadError, setProfileLoadError] = useState("");
  const endRef = useRef(null);

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
      if (!user) {
        setProfile(null);
        setHasCompletedOnboarding(false);
        setOnboardingStep("entry");
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
            setOnboardingStep("entry");
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

  const signInWithGoogle = async () => {
    setIsGoogleSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error(error);
    } finally {
      setIsGoogleSigningIn(false);
    }
  };

  useEffect(() => {
    if (!currentUser) return;
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

    const signInExistingUser = async (email) => {
    if (!currentUser) return "Please sign in with Google first.";

    try {
      setIsSigningIn(true);
      const profileIndexRef = doc(db, "artifacts", appId, "public", "data", "userProfiles", toEmailKey(email));
      const indexedProfile = await getDoc(profileIndexRef);

      if (!indexedProfile.exists()) {
        return "No user found with that email. Please create a new account.";
      }

      const profileData = indexedProfile.data();

      await setDoc(doc(db, "artifacts", appId, "users", currentUser.uid, "data", "profile"), {
        ...profileData,
        lastSignedInAt: nowMs(),
      });

      setProfile(profileData);
      setHasCompletedOnboarding(true);
      setOnboardingStep("done");
      return "";
    } catch (error) {
      console.error(error);
      return "Unable to sign in right now. Please try again.";
    } finally {
      setIsSigningIn(false);
    }
  };

  const completeOnboarding = async (data) => {
    if (!currentUser) return;
    setIsSavingProfile(true);

    const profileData = {
      ...data,
      onboardingCompletedAt: nowMs(),
    };

    try {
      await setDoc(doc(db, "artifacts", appId, "users", currentUser.uid, "data", "profile"), profileData);
      await setDoc(doc(db, "artifacts", appId, "public", "data", "userProfiles", toEmailKey(data.email)), profileData);

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
    } finally {
      setIsSavingProfile(false);
    }
  };

  const sendGreeting = async (greeting) => {
    if (!currentUser || !profile) return;

    await addDoc(collection(db, "artifacts", appId, "public", "data", "messages"), {
      uid: currentUser.uid,
      sender: profile.fullName,
      text: greeting.text,
      timestamp: nowMs(),
    });

    setPickerOpen(false);
  };

  if (isAuthLoading || (currentUser && isProfileLoading)) {
    return (
      <div className="grid h-screen place-items-center bg-slate-50">
        <Loader2 className="animate-spin text-teal-600" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-teal-50 to-cyan-100 p-2 sm:p-6">
        <div className="relative flex h-[100dvh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-white/80 bg-white/95 shadow-2xl backdrop-blur sm:h-[90vh]">
          <SignInStep
            onExistingSignIn={signInExistingUser}
            onStartNewUser={() => setOnboardingStep("details")}
            loading={isSigningIn}
            onGoogleSignIn={signInWithGoogle}
            googleLoading={isGoogleSigningIn}
          />
        </div>
      </div>
    );
  }
  
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-teal-50 to-cyan-100 p-2 sm:p-6">
      <div className="relative flex h-[100dvh] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-white/80 bg-white/95 shadow-2xl backdrop-blur sm:h-[90vh]">
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
                onStartNewUser={() => setOnboardingStep("details")}
                loading={isSigningIn}
              />
            ) : onboardingStep === "details" ? (
              <Onboarding
                onContinue={(data) => {
                  setPendingProfileData(data);
                  setOnboardingStep("photo");
                }}
                loading={isSavingProfile}
                initialData={pendingProfileData}
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
                  <h1 className="text-sm font-bold text-slate-800">Hey {profile.fullName.split(" ")[0]} 👋</h1>
                  <p className="text-xs text-slate-500">Spread kind greetings in real time</p>
                </div>
                <Sparkles className="text-teal-500" size={18} />
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
                      onClick={() => sendGreeting(greeting)}
                      className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left text-sm font-medium text-slate-700 hover:border-teal-400"
                    >
                      {greeting.text}
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
