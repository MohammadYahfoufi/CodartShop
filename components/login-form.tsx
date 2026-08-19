"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { createSupabaseBrowserClient, isBrowserAuthConfigured } from "@/lib/supabase-browser";

function destination() {
  const requested = new URLSearchParams(window.location.search).get("next") ?? "/";
  return requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";
}

function GoogleIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.4-.18-2.07H12v3.91h5.38a4.6 4.6 0 0 1-2 3.02v2.54h3.24c1.9-1.75 2.98-4.33 2.98-7.4Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.9 6.62-2.37l-3.24-2.54c-.9.6-2.05.96-3.38.96-2.61 0-4.82-1.76-5.61-4.13H3.04v2.62A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.39 13.92A6 6 0 0 1 6.08 12c0-.67.11-1.32.31-1.92V7.46H3.04A10 10 0 0 0 2 12c0 1.63.39 3.17 1.04 4.54l3.35-2.62Z"/><path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.83 1.5l2.87-2.87A9.63 9.63 0 0 0 12 2a10 10 0 0 0-8.96 5.46l3.35 2.62C7.18 7.71 9.39 5.95 12 5.95Z"/></svg>;
}

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState<"email" | "verify" | "google" | "">("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function requestEmailCode() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Account login needs the Supabase publishable key in .env.local.");
      return;
    }

    setBusy("email");
    setError("");
    setMessage("");
    const { error: authError } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { shouldCreateUser: true },
    });
    setBusy("");

    if (authError) {
      setError(authError.message);
      return;
    }

    setCodeSent(true);
    setOtp("");
    setMessage(`Enter the verification code sent to ${email.trim()}.`);
  }

  async function emailLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await requestEmailCode();
  }

  async function verifyEmailCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError("Account login needs the Supabase publishable key in .env.local.");
      return;
    }

    setBusy("verify");
    setError("");
    const { error: authError } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: otp,
      type: "email",
    });
    setBusy("");

    if (authError) {
      setError(authError.message);
      return;
    }

    window.location.assign(destination());
  }

  function changeEmail() {
    setCodeSent(false);
    setOtp("");
    setMessage("");
    setError("");
  }

  async function googleLogin() {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return setError("Account login needs the Supabase publishable key in .env.local.");
    setBusy("google");
    setError("");
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(destination())}`;
    const { error: authError } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    if (authError) { setBusy(""); setError(authError.message); }
  }

  return <main className="auth-page"><section className="auth-card"><Link href="/" className="auth-logo" aria-label="Codart home"><Image src="/codart-logo.png" alt="Codart" width={512} height={512} priority /></Link><div className="auth-heading"><span>YOUR CODART ACCOUNT</span><h1>Save what<br />you love.</h1><p>Sign in to keep favourites connected to your account across browsers and devices.</p></div><button type="button" className="google-login" onClick={googleLogin} disabled={Boolean(busy) || !isBrowserAuthConfigured}><GoogleIcon /><span>{busy === "google" ? "Connecting…" : "Continue with Google"}</span></button><div className="auth-divider"><span>or use email</span></div>{codeSent ? <form onSubmit={verifyEmailCode}><label htmlFor="login-otp">Verification code</label><input id="login-otp" className="otp-input" type="text" inputMode="numeric" autoComplete="one-time-code" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="Enter code" pattern="[0-9]{6,10}" minLength={6} maxLength={10} autoFocus required /><button type="submit" className="email-login" disabled={Boolean(busy) || otp.length < 6 || !isBrowserAuthConfigured}>{busy === "verify" ? "Checking code…" : "Sign in with code"}</button><div className="auth-form-actions"><button type="button" onClick={requestEmailCode} disabled={Boolean(busy)}>Resend code</button><button type="button" onClick={changeEmail} disabled={Boolean(busy)}>Use another email</button></div></form> : <form onSubmit={emailLogin}><label htmlFor="login-email">Email address</label><input id="login-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /><button type="submit" className="email-login" disabled={Boolean(busy) || !isBrowserAuthConfigured}>{busy === "email" ? "Sending code…" : "Email me a sign-in code"}</button></form>}{message && <p className="auth-message is-success">{message}</p>}{error && <p className="auth-message is-error">{error}</p>}{!isBrowserAuthConfigured && <p className="auth-message is-error">Supabase Auth is not configured yet. Add the publishable key to enable login.</p>}<p className="auth-terms">By continuing, you agree to use Codart responsibly. No password required.</p><Link className="auth-back" href="/">← Back to the shop</Link></section><aside className="auth-visual"><div><span>ONE ACCOUNT</span><strong>Saved everywhere.</strong><p>Your favourites stay with you—even when you switch devices.</p></div></aside></main>;
}
