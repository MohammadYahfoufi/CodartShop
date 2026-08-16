"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { money } from "@/lib/commerce";
import { createSupabaseBrowserClient, isBrowserAuthConfigured } from "@/lib/supabase-browser";
import type { AccountOrder } from "@/lib/types";
import { realtimeTopics } from "@/lib/realtime-topics";
import { orderStatusLabels } from "@/lib/order-status";

export function AccountPanel() {
  const router = useRouter();
  const [user, setUser] = useState<User | null | undefined>(() =>
    isBrowserAuthConfigured ? undefined : null,
  );
  const [orders, setOrders] = useState<AccountOrder[] | null | undefined>();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    void supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (!data.user) {
        setOrders([]);
        return;
      }
      try {
        const response = await fetch("/api/orders", { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load orders.");
        const result = (await response.json()) as { orders?: AccountOrder[] };
        setOrders(result.orders ?? []);
      } catch {
        setOrders(null);
      }
    });
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const refresh = () => { void fetch("/api/orders", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((result: { orders?: AccountOrder[] } | null) => { if (result?.orders) setOrders(result.orders); }); };
    const channel = supabase.channel(realtimeTopics.userOrders(user.id)).on("broadcast", { event: "orders-changed" }, refresh).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id]);

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    if (supabase) await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  if (user === undefined) {
    return <main className="account-page"><div className="account-card account-loading">Loading your account…</div></main>;
  }

  if (!user) {
    return (
      <main className="account-page">
        <section className="account-card">
          <Link href="/" className="account-logo"><Image src="/codart-logo.png" alt="Codart" width={512} height={512} priority /></Link>
          <p className="eyebrow">Your account</p>
          <h1>You’re browsing<br />as a guest.</h1>
          <p>Sign in to keep your cart, favourites, and orders linked across devices.</p>
          <Link className="account-primary" href="/login?next=/account">Sign in or create account</Link>
          <Link className="auth-back" href="/">← Back to the shop</Link>
        </section>
      </main>
    );
  }

  const name = user.user_metadata?.full_name
    ?? user.user_metadata?.name
    ?? user.email?.split("@")[0]
    ?? "Codart customer";
  const currentOrders = orders?.filter((order) => ["pending", "confirmed", "shipped"].includes(order.status)) ?? [];
  const previousOrders = orders?.filter((order) => ["delivered", "cancelled"].includes(order.status)) ?? [];

  function orderCard(order: AccountOrder) {
    return <article className="account-order-card" key={order.id}><header><div><small>Order</small><strong>#{order.id.slice(0, 8).toUpperCase()}</strong></div><span className={`account-order-status status-${order.status}`}>{orderStatusLabels[order.status]}</span></header><div className="account-order-items">{order.order_items.map((item) => <span key={item.id}>{item.product_title}<b>× {item.quantity}</b></span>)}</div><footer><div><strong>{money.format(Number(order.total))}</strong><small>{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(order.created_at))}</small></div><Link href={`/track-order?order=${encodeURIComponent(order.id)}`}>Track order →</Link></footer></article>;
  }

  return (
    <main className="account-page">
      <section className="account-card">
        <Link href="/" className="account-logo"><Image src="/codart-logo.png" alt="Codart" width={512} height={512} priority /></Link>
        <span className="account-profile-avatar">{String(name).charAt(0).toUpperCase()}</span>
        <p className="eyebrow">Signed in</p>
        <h1>Welcome,<br />{name}.</h1>
        <p className="account-email">{user.email}</p>
        <div className="account-links">
          <Link href="/favorites"><strong>Saved products</strong><span>Open your favourites →</span></Link>
          <Link href="/cart"><strong>Your cart</strong><span>Continue shopping →</span></Link>
        </div>
        <section className="account-orders account-order-history" id="orders" aria-live="polite">
          <header><strong>Your orders</strong><span>{orders === undefined ? "Loading…" : `${orders?.length ?? 0} total`}</span></header>
          {orders === null ? (
            <p>Order history will appear after the account-data migration is installed.</p>
          ) : orders?.length ? (
            <div className="account-order-groups">{currentOrders.length > 0 && <section><h2>Current orders</h2><div>{currentOrders.map(orderCard)}</div></section>}{previousOrders.length > 0 && <section><h2>Order history</h2><div>{previousOrders.map(orderCard)}</div></section>}</div>
          ) : orders !== undefined ? <p>No orders connected to this account yet.</p> : null}
        </section>
        <button type="button" className="account-signout" onClick={signOut}>Sign out</button>
        <Link className="auth-back" href="/">← Back to the shop</Link>
      </section>
    </main>
  );
}
