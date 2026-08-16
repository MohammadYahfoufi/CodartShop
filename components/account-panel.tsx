"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createSupabaseBrowserClient, isBrowserAuthConfigured } from "@/lib/supabase-browser";

export function AccountPanel() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(() => isBrowserAuthConfigured ? undefined : null);
  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    void supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);
  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
    router.replace("/"); router.refresh();
  }
  if (user === undefined) return <main className="account-page"><div className="account-card account-loading">Loading your account…</div></main>;
  if (!user) return <main className="account-page"><section className="account-card"><Link href="/" className="account-logo"><Image src="/codart-logo.png" alt="Codart" width={512} height={512} priority /></Link><p className="eyebrow">Your account</p><h1>You’re browsing<br />as a guest.</h1><p>Sign in to keep favourites linked to you across devices.</p><Link className="account-primary" href="/login?next=/account">Sign in or create account</Link><Link className="auth-back" href="/">← Back to the shop</Link></section></main>;
  const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split("@")[0] ?? "Codart customer";
  return <main className="account-page"><section className="account-card"><Link href="/" className="account-logo"><Image src="/codart-logo.png" alt="Codart" width={512} height={512} priority /></Link><span className="account-profile-avatar">{String(name).charAt(0).toUpperCase()}</span><p className="eyebrow">Signed in</p><h1>Welcome,<br />{name}.</h1><p className="account-email">{user.email}</p><div className="account-links"><Link href="/favorites"><strong>Saved products</strong><span>Open your favourites →</span></Link><Link href="/cart"><strong>Your cart</strong><span>Continue shopping →</span></Link></div><button type="button" className="account-signout" onClick={signOut}>Sign out</button><Link className="auth-back" href="/">← Back to the shop</Link></section></main>;
}
