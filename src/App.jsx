import React, { useState, useEffect, useRef } from "react";
import {
  Sun,
  Moon,
  Coffee,
  Heart,
  Sparkles,
  Send,
  User,
  Flame,
  Lock,
  Crown,
  Zap,
  TrendingUp,
  ChevronDown,
  ArrowRight,
  Mail,
  MapPin,
  Globe,
  X,
  Upload,
  CheckCircle,
  Loader2,
  Camera,
  Image as ImageIcon,
  Gift,
  Trophy,
  Timer,
  Activity,
  Smile,
  Meh,
  Frown,
} from "lucide-react";

import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  onSnapshot,
  addDoc,
} from "firebase/firestore";

/* =========================
   Firebase Init (REPLACE ME)
   ========================= */

// ✅ Replace these with your Firebase config values:
// Firebase Console → Project settings → Your apps → Web app → Config
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

// Used in your Firestore paths
const appId = firebaseConfig.appId;

/* =========================
   Constants & Data
   ========================= */

const GREETING_OPTIONS = [
  {
    id: "morning",
    text: "Good Morning, Have a nice day 🙂",
    icon: <Sun className="w-5 h-5 text-orange-500" />,
    color: "bg-orange-100",
    bubbleColor: "bg-orange-50 border-orange-100",
    textColor: "text-orange-900",
    locked: false,
  },
  {
    id: "afternoon",
    text: "Good Afternoon. Hope you are having a nice day 🙂",
    icon: <Coffee className="w-5 h-5 text-blue-500" />,
    color: "bg-blue-100",
    bubbleColor: "bg-blue-50 border-blue-100",
    textColor: "text-blue-900",
    locked: false,
  },
  {
    id: "night",
    text: "Good Night 🙂",
    icon: <Moon className="w-5 h-5 text-indigo-500" />,
    color: "bg-indigo-100",
    bubbleColor: "bg-indigo-50 border-indigo-100",
    textColor: "text-indigo-900",
    locked: false,
  },
  {
    id: "limited_1",
    text: "Happy Weekend! Spread the joy! 🌟",
    icon: <Timer className="w-5 h-5 text-purple-600" />,
    color: "bg-purple-100 border-purple-200",
    bubbleColor: "bg-purple-50 border-purple-100",
    textColor: "text-purple-900",
    locked: false,
    limitedTime: true,
  },
  {
    id: "premium_1",
    text: "You matter. Don't give up. ❤️",
    icon: <Heart className="w-5 h-5 text-pink-500" />,
    color: "bg-slate-50",
    bubbleColor: "bg-pink-50 border-pink-100",
    textColor: "text-pink-900",
    locked: true,
  },
];

const LEVEL_THRESHOLDS = [
  { min: 0, title: "Novice Greeter" },
  { min: 50, title: "Kindness Scout" },
  { min: 150, title: "Beacon of Hope" },
  { min: 300, title: "Sunshine Bringer" },
  { min: 600, title: "Guardian of Joy" },
];

const LEADERBOARD_DATA = [
  { city: "New York", country: "United States", score: 15420, trend: "up" },
  { city: "London", country: "United Kingdom", score: 14200, trend: "up" },
  { city: "Tokyo", country: "Japan", score: 13850, trend: "same" },
  { city: "Mumbai", country: "India", score: 12100, trend: "up" },
  { city: "Berlin", country: "Germany", score: 9500, trend: "down" },
];

const LOCATION_DATA = {
  "United States": [
    "New York",
    "Los Angeles",
    "Chicago",
    "Houston",
    "Phoenix",
    "Philadelphia",
    "San Antonio",
    "San Diego",
    "Dallas",
    "San Jose",
  ],
  "United Kingdom": [
    "London",
    "Manchester",
    "Birmingham",
    "Leeds",
    "Glasgow",
    "Southampton",
    "Liverpool",
    "Newcastle",
    "Nottingham",
  ],
  Canada: ["Toronto", "Montreal", "Vancouver", "Calgary", "Edmonton", "Ottawa", "Winnipeg"],
  India: ["Mumbai", "Delhi", "Bangalore", "Hyderabad", "Ahmedabad", "Chennai", "Kolkata", "Surat", "Pune", "Jaipur"],
  Australia: ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide", "Gold Coast", "Canberra"],
  Germany: ["Berlin", "Hamburg", "Munich", "Cologne", "Frankfurt", "Stuttgart", "Düsseldorf"],
  France: ["Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Strasbourg"],
  Japan: ["Tokyo", "Yokohama", "Osaka", "Nagoya", "Sapporo", "Fukuoka", "Kobe", "Kyoto"],
  Brazil: ["São Paulo", "Rio de Janeiro", "Brasília", "Salvador", "Fortaleza", "Belo Horizonte"],
  China: ["Shanghai", "Beijing", "Chongqing", "Tianjin", "Guangzhou", "Shenzhen"],
  Mexico: ["Mexico City", "Tijuana", "Ecatepec", "León", "Puebla", "Juárez"],
  Italy: ["Rome", "Milan", "Naples", "Turin", "Palermo", "Genoa", "Bologna"],
  Spain: ["Madrid", "Barcelona", "Valencia", "Seville", "Zaragoza", "Málaga"],
  "South Korea": ["Seoul", "Busan", "Incheon", "Daegu", "Daejeon", "Gwangju"],
  Netherlands: ["Amsterdam", "Rotterdam", "The Hague", "Utrecht", "Eindhoven"],
  Sweden: ["Stockholm", "Gothenburg", "Malmö", "Uppsala"],
};

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const currentYear = new Date().getFullYear();
const YEARS = Array.from({ length: 100 }, (_, i) => currentYear - i);
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/* =========================
   Components
   ========================= */

const AutocompleteInput = ({ icon: Icon, name, value, onChange, placeholder, options, disabled }) => {
  const [showSuggestions, setShowSuggestions] = useState(false);

  const filteredOptions = value
    ? options.filter((opt) => opt.toLowerCase().includes(value.toLowerCase()))
    : options;

  const handleSelect = (selectedValue) => {
    onChange({ target: { name, value: selectedValue } });
    setShowSuggestions(false);
  };

  return (
    <div className={`group relative transition-all ${disabled ? "opacity-50 pointer-events-none" : ""}`}>
      <Icon
        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-500 transition-colors"
        size={18}
      />
      <input
        type="text"
        name={name}
        value={value}
        onChange={(e) => {
          onChange(e);
          setShowSuggestions(true);
        }}
        onFocus={() => !disabled && setShowSuggestions(true)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all font-medium text-slate-700 text-sm shadow-sm"
        autoComplete="off"
      />
      {showSuggestions && !disabled && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border border-slate-100 rounded-xl shadow-lg max-h-40 overflow-y-auto animate-fadeIn">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelect(opt)}
                className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-teal-50 hover:text-teal-700 transition-colors first:rounded-t-xl last:rounded-b-xl"
              >
                {opt}
              </button>
            ))
          ) : (
            <div className="px-4 py-2 text-sm text-slate-400 italic">No matches found</div>
          )}
        </div>
      )}
    </div>
  );
};

const Onboarding = ({ onJoin, loading }) => {
  const [step, setStep] = useState(1);
  const [photoStatus, setPhotoStatus] = useState("idle");
  const [profileImage, setProfileImage] = useState(null);
  const fileInputRef = useRef(null);

  const [formData, setFormData] = useState({
    country: "",
    city: "",
    fullName: "",
    email: "",
    dobMonth: "",
    dobDay: "",
    dobYear: "",
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === "country") {
      setFormData((prev) => ({ ...prev, [name]: value, city: "" }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleNextStep = (e) => {
    e.preventDefault();
    if (step === 1) {
      const required = ["country", "city", "fullName", "email", "dobMonth", "dobDay", "dobYear"];
      if (required.every((key) => formData[key].trim())) {
        setStep(2);
      }
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoStatus("uploading");

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const MAX_WIDTH = 200;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);

        setProfileImage(compressedBase64);
        setPhotoStatus("uploaded");
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  const handleFinalJoin = () => {
    if (photoStatus === "uploaded") {
      onJoin({
        ...formData,
        dob: `${formData.dobMonth} ${formData.dobDay}, ${formData.dobYear}`,
        photoUrl: profileImage,
      });
    }
  };

  const availableCities =
    formData.country && LOCATION_DATA[formData.country] ? LOCATION_DATA[formData.country] : [];
  const isStep1Valid = Object.values(formData).every((val) => val.trim());

  if (loading)
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="animate-spin text-teal-600" size={32} />
      </div>
    );

  return (
    <div className="h-full flex flex-col items-center justify-center bg-white text-center animate-fadeIn relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-40 h-40 bg-teal-100 rounded-full blur-3xl opacity-50 pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-40 h-40 bg-amber-100 rounded-full blur-3xl opacity-50 pointer-events-none"></div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-sm px-6 py-6 h-full overflow-y-auto">
        <div className="flex items-center gap-2 mb-6 flex-shrink-0">
          <div className={`h-2 w-8 rounded-full transition-colors ${step >= 1 ? "bg-teal-500" : "bg-slate-200"}`}></div>
          <div className={`h-2 w-8 rounded-full transition-colors ${step >= 2 ? "bg-teal-500" : "bg-slate-200"}`}></div>
        </div>

        {step === 1 && (
          <div className="flex flex-col h-full animate-fadeIn w-full">
            <div className="flex-shrink-0 bg-gradient-to-tr from-teal-400 to-emerald-500 p-4 rounded-2xl text-white mb-6 shadow-xl shadow-teal-100 animate-scaleIn mx-auto">
              <Sparkles size={28} />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Welcome to Uplift</h1>
            <p className="text-slate-500 mb-6 leading-relaxed text-sm">
              Tell us a bit about yourself to start connecting.
            </p>

            <form onSubmit={handleNextStep} className="w-full space-y-3 mb-auto text-left">
              <div className="flex flex-col gap-3 relative z-30">
                <AutocompleteInput
                  icon={Globe}
                  name="country"
                  value={formData.country}
                  onChange={handleChange}
                  placeholder="Select Country"
                  options={Object.keys(LOCATION_DATA)}
                />
                <AutocompleteInput
                  icon={MapPin}
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder={formData.country ? "Select City" : "Select Country First"}
                  options={availableCities}
                  disabled={!formData.country}
                />
              </div>

              <div className="group relative transition-all">
                <User
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-500 transition-colors"
                  size={18}
                />
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="Full Name"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all font-medium text-slate-700 text-sm shadow-sm"
                />
              </div>

              <div className="group relative transition-all">
                <Mail
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-500 transition-colors"
                  size={18}
                />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Email Address"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 transition-all font-medium text-slate-700 text-sm shadow-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <select
                    name="dobMonth"
                    value={formData.dobMonth}
                    onChange={handleChange}
                    className="w-full pl-3 pr-8 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 text-slate-700 text-sm appearance-none"
                  >
                    <option value="">Month</option>
                    {MONTHS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                </div>

                <div className="relative w-20">
                  <select
                    name="dobDay"
                    value={formData.dobDay}
                    onChange={handleChange}
                    className="w-full pl-3 pr-8 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 text-slate-700 text-sm appearance-none"
                  >
                    <option value="">Day</option>
                    {DAYS.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                </div>

                <div className="relative w-24">
                  <select
                    name="dobYear"
                    value={formData.dobYear}
                    onChange={handleChange}
                    className="w-full pl-3 pr-8 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500/50 focus:border-teal-500 text-slate-700 text-sm appearance-none"
                  >
                    <option value="">Year</option>
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={!isStep1Valid}
                className="w-full bg-slate-800 text-white font-bold py-3.5 rounded-xl shadow-lg hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95 flex items-center justify-center gap-2 mt-6"
              >
                Continue <ArrowRight size={18} />
              </button>
            </form>
          </div>
        )}

        {step === 2 && (
          <div className="w-full flex flex-col h-full animate-fadeIn">
            <div className="flex-shrink-0 bg-slate-50 p-4 rounded-full text-teal-600 mb-6 mx-auto border border-slate-100">
              <Camera size={32} />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Profile Photo</h1>
            <p className="text-slate-500 mb-8 leading-relaxed text-sm">
              To access the chat, please upload a real picture of yourself.
            </p>

            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
            />

            <div className="flex-1 flex flex-col items-center justify-center mb-8">
              <button
                onClick={triggerFileUpload}
                disabled={photoStatus === "uploading"}
                className={`w-full max-w-xs aspect-square border-2 border-dashed rounded-full flex flex-col items-center justify-center gap-4 transition-all relative overflow-hidden shadow-sm ${
                  photoStatus === "idle"
                    ? "border-slate-300 bg-slate-50 hover:bg-slate-100 hover:border-teal-400 cursor-pointer"
                    : ""
                } ${photoStatus === "uploading" ? "border-teal-500 bg-teal-50 cursor-not-allowed" : ""} ${
                  photoStatus === "uploaded" ? "border-green-500 bg-green-50" : ""
                }`}
              >
                {photoStatus === "idle" && (
                  <>
                    <div className="bg-white p-4 rounded-full shadow-sm text-slate-400">
                      <ImageIcon size={32} />
                    </div>
                    <span className="text-sm font-semibold text-slate-500">Tap to upload photo</span>
                  </>
                )}
                {photoStatus === "uploading" && (
                  <>
                    <Loader2 size={32} className="text-teal-600 animate-spin" />
                    <span className="text-sm font-semibold text-teal-700">Processing...</span>
                  </>
                )}
                {photoStatus === "uploaded" && (
                  <div
                    className="absolute inset-0 bg-cover bg-center animate-fadeIn"
                    style={{ backgroundImage: `url("${profileImage}")` }}
                  >
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <CheckCircle size={48} className="text-white drop-shadow-lg" />
                    </div>
                  </div>
                )}
              </button>
            </div>

            <button
              onClick={handleFinalJoin}
              disabled={photoStatus !== "uploaded"}
              className="w-full bg-slate-800 text-white font-bold py-3.5 rounded-xl shadow-lg hover:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform active:scale-95 flex items-center justify-center gap-2 mt-auto"
            >
              Complete Setup <CheckCircle size={18} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

const ChatBubble = ({ message, onLike }) => {
  const isSent = message.type === "sent";
  const avatarImage = message.senderPhoto || "https://api.dicebear.com/9.x/avataaars/svg?seed=fallback";

  return (
    <div className={`flex w-full mb-4 ${isSent ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] flex ${isSent ? "flex-row-reverse" : "flex-row"} items-end gap-2`}>
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm overflow-hidden ${
            isSent ? "bg-teal-100 border-2 border-teal-500" : "bg-white border-2 border-slate-100"
          }`}
        >
          {message.sender === "Uplift Bot" ? (
            <div className="text-[10px] font-bold text-slate-400 uppercase">BOT</div>
          ) : (
            <img src={avatarImage} alt="Avatar" className="w-full h-full object-cover" />
          )}
        </div>

        <div
          className={`relative p-3 rounded-2xl shadow-sm border group ${
            isSent ? "bg-teal-600 text-white rounded-br-none border-teal-600" : "bg-white text-slate-800 rounded-bl-none border-slate-100"
          }`}
        >
          {!isSent && (
            <div className="text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-wider">
              {message.sender}
            </div>
          )}

          <div className="flex items-center gap-2 mb-1">
            <div className={`p-1.5 rounded-full ${isSent ? "bg-white/20 text-white" : "bg-slate-50"}`}>
              {isSent
                ? React.cloneElement(message.option.icon, { className: "w-4 h-4 text-white" })
                : message.option.icon}
            </div>
            <p className={`text-sm font-medium leading-relaxed ${isSent ? "text-white" : "text-slate-700"}`}>
              {message.option.text}
            </p>
          </div>

          <div className="flex justify-between items-center mt-2 min-w-[60px]">
            <span className={`text-[10px] ${isSent ? "text-teal-200" : "text-slate-300"}`}>{message.time}</span>
            <button
              onClick={() => onLike(message.id)}
              className={`flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition-all active:scale-90 ${
                message.liked
                  ? "bg-pink-100 text-pink-500"
                  : `bg-transparent ${isSent ? "text-teal-200 hover:bg-teal-700" : "text-slate-300 hover:bg-slate-100"}`
              }`}
            >
              <Heart size={12} fill={message.liked ? "currentColor" : "none"} />
              {message.liked && <span className="font-bold">1</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const MysteryGiftModal = ({ onClose, reward }) => (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
    <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center relative overflow-hidden animate-bounceIn">
      <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
        <X size={20} />
      </button>
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-amber-100/50 to-transparent pointer-events-none"></div>
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-amber-400 blur-2xl opacity-20 animate-pulse"></div>
        <Gift size={64} className="text-amber-500 mx-auto animate-bounce" />
      </div>
      <h3 className="text-xl font-bold text-slate-800 mb-2">Mystery Gift Found!</h3>
      <p className="text-slate-500 text-sm mb-6">You found a rare item while spreading kindness.</p>
      <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-6">
        <div className="flex items-center justify-center gap-2 text-2xl font-bold text-amber-600">
          <Zap size={24} fill="currentColor" /> +{reward.amount} Sparks
        </div>
      </div>
      <button
        onClick={onClose}
        className="w-full bg-amber-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-amber-200 hover:bg-amber-600 transition-colors"
      >
        Awesome!
      </button>
    </div>
  </div>
);

const MoodTracker = ({ onSelect }) => (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
    <div className="bg-white rounded-3xl p-6 max-w-sm w-full text-center animate-scaleIn">
      <h3 className="text-lg font-bold text-slate-800 mb-1">How are you feeling?</h3>
      <p className="text-xs text-slate-400 mb-6">Track your mood to see how kindness helps.</p>
      <div className="flex justify-between gap-2 mb-6">
        <button
          onClick={() => onSelect("bad")}
          className="flex-1 p-3 rounded-xl bg-slate-50 hover:bg-red-50 hover:text-red-500 transition-colors group flex flex-col items-center gap-2"
        >
          <Frown size={28} className="text-slate-400 group-hover:text-red-500" />
          <span className="text-xs font-medium">Rough</span>
        </button>
        <button
          onClick={() => onSelect("neutral")}
          className="flex-1 p-3 rounded-xl bg-slate-50 hover:bg-blue-50 hover:text-blue-500 transition-colors group flex flex-col items-center gap-2"
        >
          <Meh size={28} className="text-slate-400 group-hover:text-blue-500" />
          <span className="text-xs font-medium">Okay</span>
        </button>
        <button
          onClick={() => onSelect("good")}
          className="flex-1 p-3 rounded-xl bg-slate-50 hover:bg-green-50 hover:text-green-500 transition-colors group flex flex-col items-center gap-2"
        >
          <Smile size={28} className="text-slate-400 group-hover:text-green-500" />
          <span className="text-xs font-medium">Great</span>
        </button>
      </div>
      <button onClick={() => onSelect("skip")} className="text-xs text-slate-400 hover:text-slate-600">
        Skip for now
      </button>
    </div>
  </div>
);

/* =========================
   Main App
   ========================= */

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [activeTab, setActiveTab] = useState("chat");
  const [isSelectorOpen, setIsSelectorOpen] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [messages, setMessages] = useState([]);

  // Modals
  const [isAnimating, setIsAnimating] = useState(false);
  const [showGift, setShowGift] = useState(false);
  const [giftReward, setGiftReward] = useState({ amount: 0 });
  const [showMood, setShowMood] = useState(false);

  const chatEndRef = useRef(null);

  // 1) Auth + Stats/Profile listeners
  useEffect(() => {
    let unsubStats = null;
    let unsubProfile = null;

    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error("Anonymous sign-in failed:", err);
        setIsAuthLoading(false);
      }
    };

    initAuth();

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      // Clean up old listeners if auth user changes
      if (unsubStats) unsubStats();
      if (unsubProfile) unsubProfile();
      unsubStats = null;
      unsubProfile = null;

      setCurrentUser(user);
      setIsAuthLoading(false);

      if (!user) return;

      const statsRef = doc(db, "artifacts", appId, "users", user.uid, "data", "stats");
      const profileRef = doc(db, "artifacts", appId, "users", user.uid, "data", "profile");

      unsubStats = onSnapshot(
        statsRef,
        (docSnap) => {
          if (docSnap.exists()) {
            setUserData((prev) => ({ ...(prev || {}), ...docSnap.data() }));
          } else {
            setDoc(statsRef, { xp: 0, sparks: 120, streak: 1, dailyProgress: 0 });
          }
        },
        (error) => console.log("Stats error", error)
      );

      unsubProfile = onSnapshot(
        profileRef,
        (docSnap) => {
          if (docSnap.exists()) {
            setUserData((prev) => ({ ...(prev || {}), profile: docSnap.data() }));
          }
        },
        (error) => console.log("Profile error", error)
      );
    });

    return () => {
      if (unsubStats) unsubStats();
      if (unsubProfile) unsubProfile();
      unsubscribeAuth();
    };
  }, []);

  // 2) Chat listener
  useEffect(() => {
    if (!currentUser) return;

    const msgsRef = collection(db, "artifacts", appId, "public", "data", "messages");

    const unsubscribe = onSnapshot(
      msgsRef,
      (snapshot) => {
        let msgs = snapshot.docs.map((d) => {
          const data = d.data();
          const matchedOption = GREETING_OPTIONS.find((o) => o.id === data.optionId) || GREETING_OPTIONS[0];
          return { id: d.id, ...data, option: matchedOption };
        });

        msgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

        if (msgs.length === 0) {
          msgs = [
            {
              id: "welcome",
              type: "received",
              sender: "Uplift Bot",
              option: GREETING_OPTIONS[0],
              time: "Just now",
              liked: false,
            },
          ];
        }

        setMessages(msgs);
      },
      (error) => console.log("Chat error", error)
    );

    return () => unsubscribe();
  }, [currentUser]);

  useEffect(() => {
    if (userData?.profile) chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSelectorOpen, userData]);

  useEffect(() => {
    if (userData?.profile) setTimeout(() => setShowMood(true), 5000);
  }, [userData?.profile]);

  const handleJoin = async (profileData) => {
    if (!currentUser) return;
    await setDoc(doc(db, "artifacts", appId, "users", currentUser.uid, "data", "profile"), profileData);
  };

  const handleSend = async (option) => {
    if (!userData?.profile || !currentUser) return;

    if (option.locked) {
      setActiveTab("premium");
      setIsSelectorOpen(false);
      return;
    }

    const newMsg = {
      type: "sent",
      sender: userData.profile.fullName,
      senderPhoto: userData.profile.photoUrl || null,
      uid: currentUser.uid,
      optionId: option.id,
      timestamp: Date.now(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      liked: false,
    };

    await addDoc(collection(db, "artifacts", appId, "public", "data", "messages"), newMsg);

    setIsSelectorOpen(false);
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 1500);

    const statsRef = doc(db, "artifacts", appId, "users", currentUser.uid, "data", "stats");
    const newSparks = (userData?.sparks || 0) + 10;
    const newXp = (userData?.xp || 0) + 20;
    const newProgress = Math.min((userData?.dailyProgress || 0) + 1, 5);

    updateDoc(statsRef, { sparks: newSparks, xp: newXp, dailyProgress: newProgress });

    if (Math.random() < 0.2) {
      setTimeout(() => {
        setGiftReward({ amount: 50 });
        setShowGift(true);
        updateDoc(statsRef, { sparks: newSparks + 50 });
      }, 1000);
    }
  };

  const handleLikeMessage = (messageId) => {
    setMessages((prev) => prev.map((msg) => (msg.id === messageId ? { ...msg, liked: !msg.liked } : msg)));
  };

  const handleMoodSelect = () => {
    setShowMood(false);
  };

  const xp = userData?.xp || 0;
  const sparks = userData?.sparks || 120;
  const currentLevel = LEVEL_THRESHOLDS.slice().reverse().find((l) => xp >= l.min) || LEVEL_THRESHOLDS[0];
  const nextLevel = LEVEL_THRESHOLDS.find((l) => l.min > xp);
  const progressToNext = nextLevel ? ((xp - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100 : 100;

  if (!currentUser || isAuthLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-teal-600" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-sans text-slate-800 flex justify-center items-center">
      <div className="w-full max-w-md bg-white shadow-2xl overflow-hidden flex flex-col h-[100dvh] sm:h-[90vh] sm:rounded-3xl border-slate-200 relative">
        {!userData?.profile ? (
          <Onboarding onJoin={handleJoin} loading={isAuthLoading} />
        ) : (
          <>
            <div className="bg-white px-4 py-4 border-b border-slate-100 z-20 shadow-sm flex-shrink-0">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="bg-gradient-to-tr from-teal-400 to-emerald-500 p-2 rounded-xl text-white shadow-md shadow-teal-100">
                      <Sparkles size={20} />
                    </div>
                    <div className="absolute -bottom-1 -right-1 bg-amber-400 text-[8px] font-bold text-white px-1.5 py-0.5 rounded-full border border-white">
                      {currentLevel.min / 50 + 1}
                    </div>
                  </div>
                  <div>
                    <h1 className="text-sm font-bold text-slate-800 leading-none mb-1">{currentLevel.title}</h1>
                    <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-400 rounded-full transition-all duration-500"
                        style={{ width: `${progressToNext}%` }}
                      ></div>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {xp} / {nextLevel?.min || "MAX"} XP
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setShowMood(true)}
                    className="p-2 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                  >
                    <Activity size={18} />
                  </button>

                  <button
                    onClick={() => setActiveTab("leaderboard")}
                    className={`p-2 rounded-full transition-colors ${
                      activeTab === "leaderboard"
                        ? "bg-amber-100 text-amber-600"
                        : "bg-slate-50 text-slate-400 hover:bg-slate-100"
                    }`}
                  >
                    <Trophy size={18} />
                  </button>

                  <div
                    onClick={() => setActiveTab("premium")}
                    className="bg-amber-50 border border-amber-100 pl-2 pr-3 py-1.5 rounded-full flex items-center gap-2 cursor-pointer hover:bg-amber-100 transition-colors"
                  >
                    <Zap size={12} className="text-amber-500" fill="currentColor" />
                    <span className="text-sm font-bold text-amber-800">{sparks}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-lg">
                <div className="bg-orange-100 p-1 rounded text-orange-500">
                  <Flame size={12} fill="currentColor" />
                </div>
                <div className="flex-1">
                  <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                    <span>Daily Streak: {userData?.streak || 1}</span>
                    <span>{userData?.dailyProgress || 0}/5 Sent</span>
                  </div>
                  <div className="h-1 w-full bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-400 transition-all duration-500"
                      style={{ width: `${((userData?.dailyProgress || 0) / 5) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto bg-slate-50 relative flex flex-col">
              {activeTab === "chat" && (
                <div className="flex-1 p-4 pb-32">
                  <div className="text-center py-6">
                    <span className="text-xs font-bold text-slate-300 uppercase tracking-widest bg-slate-100 px-3 py-1 rounded-full">
                      Today
                    </span>
                  </div>

                  {messages.map((msg) => (
                    <ChatBubble
                      key={msg.id}
                      message={{ ...msg, type: msg.uid === currentUser.uid ? "sent" : "received" }}
                      onLike={handleLikeMessage}
                    />
                  ))}
                  <div ref={chatEndRef} />
                </div>
              )}

              {activeTab === "leaderboard" && (
                <div className="p-4 animate-fadeIn">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-slate-800">Top Cities</h2>
                    <button onClick={() => setActiveTab("chat")} className="p-2 bg-slate-200 rounded-full text-slate-500">
                      <X size={16} />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {LEADERBOARD_DATA.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4"
                      >
                        <div
                          className={`w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm ${
                            idx === 0
                              ? "bg-amber-100 text-amber-600"
                              : idx === 1
                              ? "bg-slate-100 text-slate-600"
                              : idx === 2
                              ? "bg-orange-50 text-orange-600"
                              : "bg-slate-50 text-slate-400"
                          }`}
                        >
                          {idx + 1}
                        </div>

                        <div className="flex-1">
                          <h3 className="font-bold text-slate-700">{item.city}</h3>
                          <span className="text-xs text-slate-400">{item.country}</span>
                        </div>

                        <div className="text-right">
                          <div className="font-bold text-teal-600">{item.score.toLocaleString()}</div>
                          <div className="text-[10px] text-slate-400 flex items-center justify-end gap-1">
                            {item.trend === "up" && <TrendingUp size={10} className="text-green-500" />} Sparks
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 bg-blue-50 p-4 rounded-xl text-center">
                    <p className="text-sm text-blue-800 font-medium">
                      Your city needs 450 more sparks to reach Top 10!
                    </p>
                  </div>
                </div>
              )}

              {activeTab === "premium" && (
                <div className="p-6 min-h-full animate-fadeIn flex flex-col items-center text-center bg-white z-30 absolute inset-0">
                  <div className="w-full flex justify-end mb-4">
                    <button onClick={() => setActiveTab("chat")} className="p-2 bg-slate-100 rounded-full">
                      <X size={20} className="text-slate-500" />
                    </button>
                  </div>

                  <div className="bg-gradient-to-tr from-purple-500 to-indigo-600 p-4 rounded-full text-white mb-6 shadow-lg shadow-purple-200">
                    <Crown size={48} />
                  </div>

                  <h2 className="text-2xl font-bold text-slate-800 mb-2">Uplift Plus</h2>
                  <p className="text-slate-500 mb-8 max-w-xs">Unlock exclusive greetings, dark mode, and double sparks.</p>

                  <div className="w-full space-y-3 mb-8">
                    <div className="bg-white border-2 border-purple-500 p-4 rounded-xl shadow-md relative overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform">
                      <div className="absolute top-0 right-0 bg-purple-500 text-white text-[10px] font-bold px-2 py-1 rounded-bl-lg uppercase">
                        Best Value
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="text-left">
                          <span className="block font-bold text-slate-800">Annual</span>
                          <span className="text-xs text-slate-500">$2.99 / month</span>
                        </div>
                        <span className="font-bold text-purple-600 text-lg">$35.99</span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-400 mt-auto">Purchases are simulated.</p>
                </div>
              )}
            </div>

            <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-100 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] transition-all duration-300 z-30 rounded-t-3xl">
              {!isSelectorOpen ? (
                <div className="p-4 bg-white pb-6">
                  <button
                    onClick={() => setIsSelectorOpen(true)}
                    className="w-full bg-slate-100 hover:bg-slate-200 transition-colors text-left px-5 py-4 rounded-2xl text-slate-500 font-medium flex justify-between items-center group"
                  >
                    <span>Select a greeting...</span>
                    <div className="bg-teal-500 p-2 rounded-full text-white shadow-sm group-hover:scale-110 transition-transform">
                      <Send size={18} />
                    </div>
                  </button>
                </div>
              ) : (
                <div className="animate-slideUp">
                  <div className="flex justify-between items-center px-6 pt-4 pb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Choose Message</span>
                    <button
                      onClick={() => setIsSelectorOpen(false)}
                      className="p-1 bg-slate-100 rounded-full hover:bg-slate-200"
                    >
                      <ChevronDown size={20} className="text-slate-500" />
                    </button>
                  </div>

                  <div className="p-4 space-y-3 pb-8">
                    {GREETING_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        onClick={() => handleSend(option)}
                        className={`w-full p-4 rounded-xl border text-left flex items-center gap-4 transition-all active:scale-95 ${
                          option.locked
                            ? "bg-slate-50 border-slate-200 opacity-80"
                            : option.limitedTime
                            ? "bg-purple-50 border-purple-200 shadow-sm"
                            : "bg-white border-slate-200 hover:border-teal-500 hover:shadow-md"
                        }`}
                      >
                        <div className={`p-2 rounded-full ${option.locked ? "bg-slate-200 text-slate-400" : "bg-slate-50"}`}>
                          {option.locked ? <Lock size={18} /> : option.icon}
                        </div>

                        <div className="flex-1">
                          <span className={`block text-sm font-semibold ${option.locked ? "text-slate-400" : option.textColor}`}>
                            {option.text}
                          </span>

                          {option.locked && (
                            <span className="text-[10px] text-purple-500 font-bold flex items-center gap-1 mt-0.5">
                              <Crown size={10} /> Premium
                            </span>
                          )}

                          {option.limitedTime && (
                            <span className="text-[10px] text-purple-600 font-bold flex items-center gap-1 mt-0.5">
                              <Timer size={10} /> Limited Time
                            </span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {isAnimating && (
              <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center">
                <div className="animate-bounceIn bg-white/90 backdrop-blur-sm border border-teal-100 p-4 rounded-2xl shadow-xl flex flex-col items-center gap-2">
                  <div className="text-amber-500">
                    <Zap size={32} fill="currentColor" />
                  </div>
                  <span className="font-bold text-teal-800">+10 Sparks</span>
                  <span className="text-xs text-slate-400 font-medium">+20 XP</span>
                </div>
              </div>
            )}

            {showGift && <MysteryGiftModal reward={giftReward} onClose={() => setShowGift(false)} />}
            {showMood && <MoodTracker onSelect={handleMoodSelect} />}
          </>
        )}
      </div>

      <style>{`
        @keyframes slideUp { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-slideUp { animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        .animate-bounceIn { animation: bounceIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        .animate-scaleIn { animation: scaleIn 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        @keyframes scaleIn { from { transform: scale(0.8); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .overflow-y-auto::-webkit-scrollbar { display: none; }
        .overflow-y-auto { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
