"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ArrowIcon } from "@/components/icons";
import { createSupabaseBrowserClient, isBrowserAuthConfigured } from "@/lib/supabase-browser";
import { realtimeTopics } from "@/lib/realtime-topics";
import { orderStatusLabels } from "@/lib/order-status";
import type { AccountOrder, OrderStatus } from "@/lib/types";

const stages: Array<{ status: OrderStatus; label: string; copy: string }> = [
  { status: "pending", label: "Pending", copy: "We received your order." },
  { status: "confirmed", label: "Confirmed", copy: "Your order is being prepared." },
  { status: "shipped", label: "On the way", copy: "Your order has left for delivery." },
  { status: "delivered", label: "Delivered", copy: "Your order has arrived." },
];
const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function OrderTracker() {
  const requestedOrder = useSearchParams().get("order") ?? "";
  const [user, setUser] = useState<User | null | undefined>(() => isBrowserAuthConfigured ? undefined : null);
  const [orders, setOrders] = useState<AccountOrder[] | null | undefined>(() => isBrowserAuthConfigured ? undefined : []);
  const [selectedId, setSelectedId] = useState(requestedOrder);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    void supabase.auth.getUser().then(async ({ data }) => {
      setUser(data.user);
      if (!data.user) { setOrders([]); return; }
      const response = await fetch("/api/orders", { cache: "no-store" });
      const result = response.ok ? await response.json() as { orders?: AccountOrder[] } : null;
      const nextOrders = result?.orders ?? [];
      setOrders(nextOrders);
      setSelectedId((current) => current && nextOrders.some((order) => order.id === current) ? current : nextOrders[0]?.id ?? "");
    });
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const supabase = createSupabaseBrowserClient(); if (!supabase) return;
    const refresh = () => { void fetch("/api/orders", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((result: { orders?: AccountOrder[] } | null) => { if (result?.orders) setOrders(result.orders); }); };
    const channel = supabase.channel(realtimeTopics.userOrders(user.id)).on("broadcast", { event: "orders-changed" }, refresh).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id]);

  const selected = useMemo(() => orders?.find((order) => order.id === selectedId) ?? null, [orders, selectedId]);
  const activeIndex = selected ? stages.findIndex((stage) => stage.status === selected.status) : -1;

  if (user === undefined || orders === undefined) return <main className="tracking-page"><section className="tracking-shell tracking-loading">Loading your orders…</section></main>;
  if (!user) return <main className="tracking-page"><section className="tracking-shell tracking-signed-out"><p className="eyebrow">Order tracking</p><h1>Sign in to see your orders.</h1><p>Your current and previous orders are connected to the account used during checkout.</p><Link className="account-primary" href="/login?next=/track-order">Sign in</Link><Link className="auth-back" href="/">← Back to the shop</Link></section></main>;

  return <main className="tracking-page"><section className="tracking-shell"><Link className="tracking-back" href="/"><ArrowIcon /> Back to shop</Link><header className="tracking-heading"><div><p className="eyebrow">Your purchases</p><h1>Track orders.</h1><p>Choose any current or previous order to see its latest status.</p></div><span>{orders?.length ?? 0} total</span></header>{orders?.length ? <div className="tracking-dashboard"><aside className="tracking-order-list" aria-label="Your orders">{orders.map((order) => <button type="button" className={selectedId === order.id ? "is-active" : ""} onClick={() => setSelectedId(order.id)} key={order.id}><span><strong>#{order.id.slice(0, 8).toUpperCase()}</strong><small>{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(order.created_at))}</small></span><span><b className={`status-${order.status}`}>{orderStatusLabels[order.status]}</b><strong>{money.format(Number(order.total))}</strong></span></button>)}</aside>{selected && <article className="tracking-result"><div className="tracking-result-head"><div><small>Selected order</small><strong>#{selected.id.slice(0, 8).toUpperCase()}</strong></div><div><small>Total</small><strong>{money.format(Number(selected.total))}</strong></div></div>{selected.status === "cancelled" ? <div className="tracking-cancelled"><strong>Cancelled</strong><span>This order was cancelled. Contact us if you need help.</span></div> : <ol className="tracking-timeline">{stages.map((stage, index) => <li className={index < activeIndex ? "is-complete" : index === activeIndex ? "is-current" : ""} key={stage.status}><i /><div><strong>{stage.label}</strong><span>{stage.copy}</span></div></li>)}</ol>}<div className="tracking-items">{selected.order_items.map((item) => <span key={item.id}>{item.product_title}<b>× {item.quantity}</b></span>)}</div></article>}</div> : <div className="tracking-empty"><strong>No orders yet</strong><p>Orders placed while signed in will appear here automatically.</p><Link href="/#products">Browse products</Link></div>}<div className="tracking-links"><Link href="/account">My account</Link></div></section></main>;
}
