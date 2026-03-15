import React, { useMemo, useState } from "react";
import {
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Sparkles,
} from "lucide-react";

export default function SignInStep({
  onEmailLinkSignIn,
  onPasswordSignIn,
  onPasswordSignUp,
  onForgotPassword,
  onGoogleSignIn,
  loading,
  googleLoading,
  googleError,
  emailLinkMessage,
  authError,
}) {
  const [mode, setMode] = useState("signin"); // signin | signup | link
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState("");
  const [localMessage, setLocalMessage] = useState("");

  const busy = loading || googleLoading;

  const ctaText = useMemo(() => {
    if (mode === "signup") return "Create account";
    if (mode === "link") return "Email me a sign-in link";
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

    if (!normalizedEmail) {
      setLocalError("Please enter your email address.");
      return;
    }

    if (mode === "signup" && !fullName.trim()) {
      setLocalError("Please enter your full name.");
      return;
    }

    if ((mode === "signin" || mode === "signup") && !password.trim()) {
      setLocalError("Please enter your password.");
      return;
    }

    if (mode === "link") {
      const result = await onEmailLinkSignIn(normalizedEmail);
      if (result?.error) {
        setLocalError(result.error);
      }
      return;
    }

    if (mode === "signin") {
      const result = await onPasswordSignIn(normalizedEmail, password);
      if (result?.error) {
        setLocalError(result.error);
      }
      return;
    }

    const result = await onPasswordSignUp({
      email: normalizedEmail,
      password,
      fullName: fullName.trim(),
    });

    if (result?.error) {
      setLocalError(result.error);
    }
  };

  const handleForgotPassword = async () => {
    resetMessages();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setLocalError("Enter your email first, then tap Forgot password.");
      return;
    }

    const result = await onForgotPassword(normalizedEmail);
    if (result?.error) {
      setLocalError(result.error);
      return;
    }

    setLocalMessage("Password reset email sent. Please check your inbox.");
  };

  return (
    <div className="h-full w-full bg-gradient-to-b from-[#edf5f6] via-[#f7f7f6] to-[#f6f5f2] px-6 pt-8 pb-6">
      <div className="mx-auto w-full max-w-sm">
        <div className="flex justify-center pb-4">
          <div className="rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-400 p-4 text-white shadow-md">
            <Sparkles size={24} />
          </div>
        </div>

        <h1 className="text-center text-[40px] leading-[1.05] font-extrabold tracking-[-0.02em] text-slate-800 sm:text-[44px]">
          Welcome to Uplift
        </h1>
        <p className="pb-5 text-center text-[20px] leading-tight text-slate-500 sm:text-2xl">
          Sign in with Google, password, or an email link.
        </p>

        <button
          type="button"
          onClick={onGoogleSignIn}
          disabled={googleLoading}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white py-3 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {googleLoading ? <Loader2 className="animate-spin" size={18} /> : "Continue with Google"}
        </button>

        {googleError ? <p className="mb-3 text-sm text-rose-600">{googleError}</p> : null}

        <div className="mb-4 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => {
              resetMessages();
              setMode("signin");
            }}
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${
              mode === "signin"
                ? "bg-teal-600 text-white"
                : "border border-slate-200 bg-white text-slate-700"
            }`}
          >
            Sign in
          </button>

          <button
            type="button"
            onClick={() => {
              resetMessages();
              setMode("signup");
            }}
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${
              mode === "signup"
                ? "bg-teal-600 text-white"
                : "border border-slate-200 bg-white text-slate-700"
            }`}
          >
            Sign up
          </button>

          <button
            type="button"
            onClick={() => {
              resetMessages();
              setMode("link");
            }}
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${
              mode === "link"
                ? "bg-teal-600 text-white"
                : "border border-slate-200 bg-white text-slate-700"
            }`}
          >
            Email link
          </button>
        </div>

        <form className="space-y-3" onSubmit={handleSubmit}>
          {mode === "signup" ? (
            <div className="relative">
              <input
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Full Name"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 px-4 text-base text-slate-700 placeholder:text-slate-400"
              />
            </div>
          ) : null}

          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email Address"
              autoComplete="email"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pr-3 pl-11 text-base text-slate-700 placeholder:text-slate-400"
            />
          </div>

          {mode !== "link" ? (
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pr-12 pl-11 text-base text-slate-700 placeholder:text-slate-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          ) : null}

          {mode === "signin" ? (
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-sm font-medium text-teal-700 hover:text-teal-800"
            >
              Forgot password?
            </button>
          ) : null}

          {localError ? <p className="text-sm text-rose-600">{localError}</p> : null}
          {authError ? <p className="text-sm text-rose-600">{authError}</p> : null}
          {localMessage ? <p className="text-sm text-emerald-600">{localMessage}</p> : null}
          {emailLinkMessage ? <p className="text-sm text-emerald-600">{emailLinkMessage}</p> : null}

          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 py-4 text-xl font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : ctaText}
          </button>
        </form>
      </div>
    </div>
  );
}
