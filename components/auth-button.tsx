"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

type Profile = { id: string; email: string; name: string; avatar: string; admin: boolean };

function AccountIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></svg>;
}

export function AuthButton() {
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    const loadProfile = async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        const result: { user?: Profile | null } = response.ok
          ? await response.json()
          : { user: null };
        if (result.user) {
          setProfile(result.user);
          return;
        }

        // Keep the account control in sync immediately after a magic-link
        // callback, while the server remains authoritative for admin access.
        const { data, error } = supabase
          ? await supabase.auth.getUser()
          : { data: { user: null }, error: null };
        if (error || !data.user) {
          setProfile(null);
          return;
        }
        const metadata = data.user.user_metadata ?? {};
        const email = data.user.email ?? "";
        const name = typeof metadata.full_name === "string"
          ? metadata.full_name
          : typeof metadata.name === "string"
            ? metadata.name
            : email.split("@")[0] || "Codart customer";
        const avatar = typeof metadata.avatar_url === "string" && metadata.avatar_url.startsWith("https://")
          ? metadata.avatar_url
          : "";
        setProfile({ id: data.user.id, email, name, avatar, admin: false });
      } catch {
        setProfile(null);
      }
    };

    void loadProfile();
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange(() => loadProfile());
    return () => data.subscription.unsubscribe();
  }, []);

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
    setProfile(null);
    window.location.assign("/");
  }

  if (!profile) {
    return (
      <Link className="account-trigger" href="/login" aria-label="Sign in to your account">
        <span className="account-avatar"><AccountIcon /></span>
        <span>Sign in</span>
      </Link>
    );
  }

  const initial = profile.name.charAt(0).toUpperCase();
  const avatarStyle = profile.avatar ? { backgroundImage: `url(${profile.avatar})` } : undefined;

  return (
    <details className="profile-menu">
      <summary className="account-trigger is-signed-in" aria-label={`Open ${profile.name}'s profile menu`}>
        <span className={`account-avatar ${profile.avatar ? "has-photo" : ""}`} style={avatarStyle}>
          {profile.avatar ? null : initial}
        </span>
        <span>{profile.name}</span>
        <i aria-hidden="true" />
      </summary>
      <div className="profile-popover">
        <header>
          <span className={`profile-popover-avatar ${profile.avatar ? "has-photo" : ""}`} style={avatarStyle}>
            {profile.avatar ? null : initial}
          </span>
          <div><strong>{profile.name}</strong><small>{profile.email}</small></div>
        </header>
        <nav aria-label="Account menu">
          <Link href="/account"><span>My account</span><b aria-hidden="true">-&gt;</b></Link>
          <Link href="/account#orders"><span>My orders</span><b aria-hidden="true">-&gt;</b></Link>
          <Link href="/track-order"><span>Track an order</span><b aria-hidden="true">-&gt;</b></Link>
          <Link href="/favorites"><span>Saved products</span><b aria-hidden="true">-&gt;</b></Link>
          {profile.admin && <Link href="/admin"><span>Admin dashboard</span><b aria-hidden="true">-&gt;</b></Link>}
        </nav>
        <button type="button" onClick={signOut}>Sign out</button>
      </div>
    </details>
  );
}
