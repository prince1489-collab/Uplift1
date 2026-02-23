import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  ChevronDown,
  Globe,
  Loader2,
  Mail,
  MapPin,
  Send,
  Sparkles,
  User,
} from "lucide-react";

import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
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
const appId = firebaseConfig.appId;

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));
const YEARS = Array.from({ length: 100 }, (_, i) => String(new Date().getFullYear() - i));

const COUNTRIES = {
  "United States": ["New York", "Los Angeles", "Chicago", "Houston"],
  "United Kingdom": ["London", "Manchester", "Birmingham"],
  India: ["Mumbai", "Delhi", "Bangalore"],
  Canada: ["Toronto", "Montreal", "Vancouver"],
};

const nowMs = () => Date.now();

const GREETINGS = [
  { id: "morning", text: "Good Morning, have a nice day! ☀️" },
  { id: "afternoon", text: "Good Afternoon, hope you are doing great! 💛" },
  { id: "night", text: "Good Night! Sleep well 🌙" },
];

function InputRow({ icon, children }) {
  const Icon = icon;
  return (
    <div className="relative">
      <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
      {children}
    </div>
  );
}

function Onboarding({ onComplete, loading }) {
  const [form, setForm] = useState({
    country: "",
    city: "",
    fullName: "",
    email: "",
    dobMonth: "",
    dobDay: "",
    dobYear: "",
  });

  const cities = form.country ? COUNTRIES[form.country] || [] : [];
  const dobComplete = form.dobMonth && form.dobDay && form.dobYear;
  const valid = Object.values(form).every(Boolean);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-600" />
      </div>
    );
  }

  const onChange = (e) => {
    const { name, value } = e.target;
    if (name === "country") {
      setForm((p) => ({ ...p, country: value, city: "" }));
      return;
    }
    setForm((p) => ({ ...p, [name]: value }));
  };

  return (
    <div className="h-full flex items-center justify-center p-5">
      <form
        className="w-full max-w-sm space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          onComplete({ ...form, dob: `${form.dobMonth} ${form.dobDay}, ${form.dobYear}` });
        }}
      >
        <div className="flex justify-center">
          <div className="bg-gradient-to-tr from-teal-500 to-emerald-500 p-3 rounded-2xl text-white shadow-lg">
            <Sparkles />
          </div>
        </div>
        <h1 className="text-xl font-bold text-center text-slate-800">Welcome to Uplift</h1>
        <p className="text-sm text-center text-slate-500">Quick setup to start chatting live.</p>

        <InputRow icon={Globe}>
          <select
            name="country"
            value={form.country}
            onChange={onChange}
            className="w-full pl-9 pr-3 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm"
          >
            <option value="">Select Country</option>
            {Object.keys(COUNTRIES).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </InputRow>

        <InputRow icon={MapPin}>
          <select
            name="city"
            value={form.city}
            onChange={onChange}
            disabled={!form.country}
            className="w-full pl-9 pr-3 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm disabled:opacity-50"
          >
            <option value="">Select City</option>
            {cities.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </InputRow>

        <InputRow icon={User}>
          <input
            name="fullName"
            value={form.fullName}
            onChange={onChange}
            placeholder="Full Name"
            className="w-full pl-9 pr-3 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm"
          />
        </InputRow>

        <InputRow icon={Mail}>
          <input
            type="email"
            name="email"
            value={form.email}
            onChange={onChange}
            placeholder="Email Address"
            className="w-full pl-9 pr-3 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm"
          />
        </InputRow>

        <div className="rounded-2xl border border-teal-200 bg-teal-50/60 p-3">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase tracking-wide text-teal-700">Date of Birth *</label>
            {!dobComplete && <span className="text-[11px] font-semibold text-teal-600">Required</span>}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select name="dobMonth" value={form.dobMonth} onChange={onChange} aria-label="Date of birth month" className="py-2 px-2 rounded-lg border border-slate-200 text-sm bg-white">
              <option value="">Month</option>
              {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select name="dobDay" value={form.dobDay} onChange={onChange} aria-label="Date of birth day" className="py-2 px-2 rounded-lg border border-slate-200 text-sm bg-white">
              <option value="">Day</option>
              {DAYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            <select name="dobYear" value={form.dobYear} onChange={onChange} aria-label="Date of birth year" className="py-2 px-2 rounded-lg border border-slate-200 text-sm bg-white">
              <option value="">Year</option>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <p className="text-[11px] mt-2 text-teal-700">Used for age checks and birthday shout-outs.</p>
        </div>

        <button
          type="submit"
          disabled={!valid}
          className="w-full py-3 rounded-xl bg-slate-800 text-white font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
        >
          Join Chat <ArrowRight size={16} />
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
  const [lastLiveAt, setLastLiveAt] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setIsAuthLoading(false);
      if (!user) return;

      const profileRef = doc(db, "artifacts", appId, "users", user.uid, "data", "profile");
      return onSnapshot(profileRef, (snap) => setProfile(snap.exists() ? snap.data() : null));
    });

    return () => unsub();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const q = query(collection(db, "artifacts", appId, "public", "data", "messages"), orderBy("timestamp", "asc"), limit(100));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const live = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMessages(
          live.length
            ? live
            : [{ id: "welcome", sender: "Uplift Bot", text: "Welcome! Chat is live and ready ✨", uid: "system", timestamp: Date.now() }]
        );
        setIsChatLive(true);
        setLastLiveAt(new Date());
      },
      () => setIsChatLive(false)
    );

    return () => unsub();
  }, [currentUser]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const chatStatusText = useMemo(() => {
    if (!isChatLive) return "Reconnecting chat...";
    return "Live chat connected";
  }, [isChatLive]);

  const completeOnboarding = async (data) => {
    if (!currentUser) return;

    await setDoc(doc(db, "artifacts", appId, "users", currentUser.uid, "data", "profile"), data);

    await addDoc(collection(db, "artifacts", appId, "public", "data", "messages"), {
      uid: "system",
      sender: "Uplift Bot",
      text: `${data.fullName} just joined Uplift 👋`,
      timestamp: nowMs(),
    });
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

  if (!currentUser || isAuthLoading) {
    return (
      <div className="h-screen grid place-items-center bg-slate-50">
        <Loader2 className="animate-spin text-teal-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-teal-50 to-cyan-100 p-2 sm:p-6 flex items-center justify-center">
      <div className="w-full max-w-md h-[100dvh] sm:h-[90vh] rounded-3xl border border-white/80 bg-white/95 backdrop-blur shadow-2xl overflow-hidden flex flex-col relative">
        {!profile ? (
          <Onboarding onComplete={completeOnboarding} loading={isAuthLoading} />
        ) : (
          <>
            <header className="px-4 py-3 border-b border-slate-100 bg-white/90 backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-sm font-bold text-slate-800">Hey {profile.fullName.split(" ")[0]} 👋</h1>
                  <p className="text-xs text-slate-500">Spread kind greetings in real time</p>
                </div>
                <Sparkles className="text-teal-500" size={18} />
              </div>

              <div className="mt-2 flex items-center justify-between text-[11px]">
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full font-semibold ${isChatLive ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isChatLive ? "bg-emerald-500 animate-pulse" : "bg-amber-500"}`}></span>
                  {chatStatusText}
                </span>
                {lastLiveAt && (
                  <span className="text-slate-400">Updated {lastLiveAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                )}
              </div>
            </header>

            <main className="flex-1 overflow-y-auto p-4 bg-slate-50/60">
              {messages.map((m) => {
                const mine = m.uid === currentUser.uid;
                return (
                  <div key={m.id} className={`mb-3 flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[82%] px-3 py-2 rounded-2xl border text-sm ${mine ? "bg-teal-600 text-white border-teal-600 rounded-br-none" : "bg-white text-slate-700 border-slate-200 rounded-bl-none"}`}>
                      <div className={`text-[10px] mb-1 font-semibold ${mine ? "text-teal-100" : "text-slate-400"}`}>{m.sender}</div>
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
                  className="w-full py-3 px-4 rounded-2xl bg-slate-100 text-slate-600 flex items-center justify-between"
                >
                  <span>Select a greeting...</span>
                  <span className="p-2 rounded-full bg-teal-500 text-white"><Send size={14} /></span>
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-slate-400 uppercase">Choose Message</span>
                    <button onClick={() => setPickerOpen(false)} className="p-1 rounded-full bg-slate-100">
                      <ChevronDown size={16} className="text-slate-500" />
                    </button>
                  </div>
                  {GREETINGS.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => sendGreeting(g)}
                      className="w-full p-3 rounded-xl border border-slate-200 bg-white text-left text-sm font-medium text-slate-700 hover:border-teal-400"
                    >
                      {g.text}
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
