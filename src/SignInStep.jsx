// Copyright © 2025 Mahiman Singh Rathore. All rights reserved.

import React, { useMemo, useState } from "react";
import {
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";

export default function SignInStep({
  onEmailLinkSignIn,
  onPasswordSignIn,
  onPasswordSignUp,
  onForgotPassword,
  onGoogleSignIn,
  onAppleSignIn,
  loading,
  googleLoading,
  googleError,
  emailLinkMessage,
  authError,
}) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState("");
  const [localMessage, setLocalMessage] = useState("");

  const busy = loading || googleLoading;

  const ctaText = useMemo(() => {
    if (mode === "signup") return "Create account";
    return "Sign in";
  }, [mode]);

  const resetMessages = () => {
    setLocalError("");
    setLocalMessage("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    resetMessages();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) { setLocalError("Please enter your email address."); return; }
    if (mode === "signup" && !fullName.trim()) { setLocalError("Please enter your full name."); return; }
    if ((mode === "signin" || mode === "signup") && !password.trim()) { setLocalError("Please enter your password."); return; }
    if (mode === "signin") {
      const result = await onPasswordSignIn(normalizedEmail, password);
      if (result?.error) setLocalError(result.error);
      return;
    }
    const result = await onPasswordSignUp({ email: normalizedEmail, password, fullName: fullName.trim() });
    if (result?.error) setLocalError(result.error);
  };

  const handleForgotPassword = async () => {
    resetMessages();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) { setLocalError("Enter your email first, then tap Forgot password."); return; }
    const result = await onForgotPassword(normalizedEmail);
    if (result?.error) { setLocalError(result.error); return; }
    setLocalMessage("Password reset email sent. Please check your inbox.");
  };

  // seen-auth-bg is not decoration: this gradient is hardcoded light, but [data-dark-shell]
  // lives on <body>, so in dark mode the remaps reached this screen's text and buttons while
  // the background stayed cream — "Welcome to Seen" rendered near-white on cream, and the
  // white buttons turned black. The class gives the background a dark variant so it moves
  // with them.
  return (
    <div className="seen-auth-bg h-full w-full bg-gradient-to-b from-[#FFF6EF] via-[#f7f7f6] to-[#f6f5f2] px-6 pt-8 pb-6">
      <div className="mx-auto w-full max-w-sm">
        <div className="flex justify-center pb-4">
          {/* The real app icon rather than a stand-in glyph. This used to be a Sparkles icon
              in a gradient box, which meant the first screen anyone sees showed a different
              logo from the one they just tapped on their home screen. */}
          <img src="/icon-192.png" alt="" width={72} height={72}
            className="rounded-[20px] shadow-md" />
        </div>

        {/* Explicit palette hexes, not text-slate-*: the slate classes are exactly what the
            dark shell remaps, and this heading must stay readable on the cream background. */}
        <h1 className="seen-auth-title font-display text-center text-[40px] leading-[1.05] font-normal tracking-[-0.03em] sm:text-[44px]">
          Welcome to Seen
        </h1>
        <p className="seen-auth-sub pb-5 text-center text-[18px] leading-snug sm:text-xl">
          Good to see you. Welcome back or join us.
        </p>

        <button type="button" onClick={onGoogleSignIn} disabled={googleLoading}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border py-3 text-base font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-70"
          style={{ borderColor: "#E7D9CD", background: "#FFFFFF", color: "#3D3229" }}>
          {googleLoading ? <Loader2 className="animate-spin" size={18} /> : "Continue with Google"}
        </button>

        {onAppleSignIn ? (
          <button type="button" onClick={onAppleSignIn} disabled={googleLoading}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-black bg-black py-3 text-base font-semibold text-white transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-70">
            {googleLoading ? <Loader2 className="animate-spin" size={18} /> : <span className="leading-none">Continue with Apple</span>}
          </button>
        ) : null}

        {googleError ? <p className="mb-3 text-sm text-rose-600">{googleError}</p> : null}

        <div className="mb-4 grid grid-cols-2 gap-2">
          {[["signin","I'm back"],["signup","I'm new"]].map(([m, label]) => (
            <button key={m} type="button" onClick={() => { resetMessages(); setMode(m); }}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
              mode === m ? "bg-teal-600 text-white" : "border"
            }`}
            style={mode === m ? undefined : { borderColor: "#E7D9CD", background: "#FFFDFB", color: "#5C4A3E" }}>
              {label}
            </button>
          ))}
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          {mode === "signup" && (
            <div className="relative">
              <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Full Name"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 px-4 text-base text-slate-700 placeholder:text-slate-400" />
            </div>
          )}

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email Address" autoComplete="email"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pr-3 pl-11 text-base text-slate-700 placeholder:text-slate-400" />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Password" autoComplete={mode === "signup" ? "new-password" : "current-password"}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pr-12 pl-11 text-base text-slate-700 placeholder:text-slate-400" />
            <button type="button" onClick={() => setShowPassword((p) => !p)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
              aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {mode === "signin" && (
            <button type="button" onClick={handleForgotPassword} className="text-sm font-medium text-teal-700 hover:text-teal-800">
              Forgot password?
            </button>
          )}

          {localError && <p className="text-sm text-rose-600">{localError}</p>}
          {authError && <p className="text-sm text-rose-600">{authError}</p>}
          {localMessage && <p className="text-sm text-emerald-600">{localMessage}</p>}
          {emailLinkMessage && <p className="text-sm text-emerald-600">{emailLinkMessage}</p>}

          <button type="submit" disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 py-4 text-xl font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-70">
            {loading ? <Loader2 className="animate-spin" size={20} /> : ctaText}
          </button>
        </form>
      </div>
    </div>
  );
}
