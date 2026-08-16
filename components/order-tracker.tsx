"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { realtimeTopics } from "@/lib/realtime-topics";
import type { OrderStatus } from "@/lib/types";

type TrackedOrder = { id: string; status: OrderStatus; created_at: string; updated_at: string; total: number; delivery_area: string; order_items: Array<{ id: number; product_title: string; quantity: number }> };
const stages: Array<{ status: OrderStatus; label: string; copy: string }> = [
  { status: "pending", label: "Pending", copy: "We received your order." },
  { status: "confirmed", label: "Confirmed", copy: "Your order is being prepared." },
  { status: "shipped", label: "On the way", copy: "Your order has left for delivery." },
  { status: "delivered", label: "Delivered", copy: "Your order has arrived." },
];

export function OrderTracker() {
  const searchParams = useSearchParams();
  const [orderId, setOrderId] = useState(searchParams.get("order") ?? "");
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const loadOrder = useCallback(async () => {
    setLoading(true); setError("");
    try { const response = await fetch("/api/orders/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderId, phone }), cache: "no-store" }); const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Unable to track order."); setOrder(result.order); }
    catch (caught) { setOrder(null); setError(caught instanceof Error ? caught.message : "Unable to track order."); }
    finally { setLoading(false); }
  }, [orderId, phone]);
  function submit(event: FormEvent) { event.preventDefault(); void loadOrder(); }

  useEffect(() => {
    if (!order?.id) return;
    const supabase = createSupabaseBrowserClient(); if (!supabase) return;
    const channel = supabase.channel(realtimeTopics.orderStatus(order.id)).on("broadcast", { event: "status-changed" }, () => void loadOrder()).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [loadOrder, order?.id]);

  const activeIndex = order ? stages.findIndex((stage) => stage.status === order.status) : -1;
  return <main className="tracking-page"><section className="tracking-shell"><header><p className="eyebrow">Live order tracking</p><h1>Where’s my order?</h1><p>Enter the complete order number and the phone used during checkout.</p></header><form className="tracking-form" onSubmit={submit}><label><span>Order number</span><input value={orderId} onChange={(event) => setOrderId(event.target.value)} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" required /></label><label><span>Phone number</span><input value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" autoComplete="tel" placeholder="Your checkout phone" required /></label><button type="submit" disabled={loading}>{loading ? "Checking…" : "Track order"}</button></form>{error && <p className="tracking-error" role="alert">{error}</p>}{order && <article className="tracking-result"><div className="tracking-result-head"><div><small>Order</small><strong>#{order.id.slice(0, 8).toUpperCase()}</strong></div><div><small>Total</small><strong>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(order.total)}</strong></div></div>{order.status === "cancelled" ? <div className="tracking-cancelled"><strong>Cancelled</strong><span>This order was cancelled. Contact us if you need help.</span></div> : <ol className="tracking-timeline">{stages.map((stage, index) => <li className={index < activeIndex ? "is-complete" : index === activeIndex ? "is-current" : ""} key={stage.status}><i /><div><strong>{stage.label}</strong><span>{stage.copy}</span></div></li>)}</ol>}<div className="tracking-items">{order.order_items.map((item) => <span key={item.id}>{item.product_title}<b>× {item.quantity}</b></span>)}</div></article>}<Link className="auth-back" href="/">← Back to the shop</Link></section></main>;
}
