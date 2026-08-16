"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";

function AccountIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/></svg>;
}

export function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => setUser(data.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  const name = user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user?.email?.split("@")[0] ?? "Account";
  const photo = typeof user?.user_metadata?.avatar_url === "string" && user.user_metadata.avatar_url.startsWith("https://") ? user.user_metadata.avatar_url : "";
  return <Link className={`account-trigger ${user ? "is-signed-in" : ""}`} href={user ? "/account" : "/login"} aria-label={user ? `Open ${name}'s account` : "Sign in to your account"}><span className={`account-avatar ${photo ? "has-photo" : ""}`} style={photo ? { backgroundImage: `url(${photo})` } : undefined}>{user ? photo ? null : String(name).charAt(0).toUpperCase() : <AccountIcon />}</span><span>{user ? name : "Sign in"}</span></Link>;
}
