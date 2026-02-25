import React, { useState } from "react";
import { Loader2, Mail, Sparkles } from "lucide-react";

function SignInStep({ onExistingSignIn, onStartNewUser, loading, onGoogleSignIn, googleLoading }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");

  const submit = async (event) => {
    event.preventDefault();

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setError("");
    const nextError = await onExistingSignIn(email.trim());
    if (nextError) setError(nextError);
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
          Welcome back
        </h1>
        <p className="pb-5 text-center text-[20px] leading-tight text-slate-500 sm:text-2xl">
          Sign in with Google, then continue with your Uplift profile.
        </p>

        <button
          onClick={onGoogleSignIn}
          disabled={googleLoading}
          className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white py-3 text-base font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {googleLoading ? <Loader2 className="animate-spin" size={18} /> : "Continue with Google"}
        </button>

        <form className="space-y-3" onSubmit={submit}>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email Address"
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pr-3 pl-11 text-base text-slate-700 placeholder:text-slate-400"
            />
          </div>

          {error ? <p className="text-sm text-rose-600">{error}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-600 py-4 text-xl font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? <Loader2 className="animate-spin" size={20} /> : "Sign In"}
          </button>
        </form>

        <button
          onClick={onStartNewUser}
