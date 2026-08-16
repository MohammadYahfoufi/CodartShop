"use client";

import { useEffect, useMemo, useState } from "react";
import { SearchIcon } from "@/components/icons";
import { ToastStack, type ToastMessage } from "@/components/feedback";
import { deliveryAreas, paymentMethods } from "@/lib/checkout";
import type { AdminOrder, OrderStatus } from "@/lib/types";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { realtimeTopics } from "@/lib/realtime-topics";
import { orderStatusLabels } from "@/lib/order-status";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const statuses: OrderStatus[] = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

export function OrdersManager({ initialOrders }: { initialOrders: AdminOrder[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [updating, setUpdating] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");
  const [page, setPage] = useState(1);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const pageSize = 12;
  const matching = useMemo(() => orders.filter((order) => {
    const matchesStatus = filter === "all" || order.status === filter;
    const term = query.trim().toLowerCase();
    return matchesStatus && (!term || `${order.id} ${order.customer_name} ${order.customer_phone} ${order.customer_email ?? ""}`.toLowerCase().includes(term));
  }), [filter, orders, query]);
  const totalPages = Math.max(1, Math.ceil(matching.length / pageSize));
  const visible = matching.slice((Math.min(page, totalPages) - 1) * pageSize, Math.min(page, totalPages) * pageSize);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const refresh = () => { void fetch("/api/admin/orders", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((result: { orders?: AdminOrder[] } | null) => { if (result?.orders) setOrders(result.orders); }); };
    const channel = supabase.channel(realtimeTopics.adminOrders).on("broadcast", { event: "orders-changed" }, refresh).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  function notify(message: string, tone: ToastMessage["tone"] = "info") { setToasts((items) => [...items, { id: Date.now() + Math.random(), message, tone }]); }
  async function updateStatus(id: string, status: OrderStatus) {
    setUpdating(id);
    try {
      const response = await fetch(`/api/orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to update order.");
      setOrders((items) => items.map((order) => order.id === id ? { ...order, status } : order));
      notify("Order status updated.", "success");
    } catch (error) { notify(error instanceof Error ? error.message : "Unable to update order.", "error"); }
    finally { setUpdating(""); }
  }

  return <main className="admin-workspace"><header className="admin-page-heading"><div><p className="eyebrow">Fulfilment</p><h1>Orders</h1><p>Review customer details, delivery, payment, and fulfilment status.</p></div><span className="admin-heading-count">{matching.length} shown</span></header><div className="admin-table-tools"><label className="admin-list-search"><SearchIcon /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search name, phone, email, or order" /></label><select value={filter} onChange={(event) => { setFilter(event.target.value as "all" | OrderStatus); setPage(1); }}><option value="all">All statuses</option>{statuses.map((status) => <option value={status} key={status}>{orderStatusLabels[status]}</option>)}</select></div><section className="orders-page-list">{visible.length ? visible.map((order) => { const area = deliveryAreas.find((item) => item.value === order.delivery_area)?.label; const payment = paymentMethods.find((item) => item.value === order.payment_method)?.label; return <article className="order-row" key={order.id}><div className="order-row-id"><small>Order</small><strong>#{order.id.slice(0, 8).toUpperCase()}</strong><time>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.created_at))}</time></div><div className="order-row-customer"><strong>{order.customer_name}</strong><a href={`tel:${order.customer_phone}`}>{order.customer_phone}</a>{order.customer_email && <a href={`mailto:${order.customer_email}`}>{order.customer_email}</a>}{order.delivery_address && <p>{order.delivery_address}{area ? ` · ${area}` : ""}</p>}{payment && <small>{payment}</small>}{order.customer_note && <p>{order.customer_note}</p>}</div><div className="order-row-items">{order.order_items.map((item) => <span key={item.id}>{item.product_title} × {item.quantity}</span>)}</div><strong className="order-row-total">{money.format(Number(order.total))}</strong><select className={`status-select status-${order.status}`} value={order.status} disabled={updating === order.id} onChange={(event) => void updateStatus(order.id, event.target.value as OrderStatus)}>{statuses.map((status) => <option value={status} key={status}>{orderStatusLabels[status]}</option>)}</select></article>; }) : <div className="dashboard-empty">No orders match these filters.</div>}</section>{totalPages > 1 && <nav className="admin-pagination"><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><span>Page {Math.min(page, totalPages)} of {totalPages}</span><button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</button></nav>}<ToastStack toasts={toasts} dismiss={(id) => setToasts((items) => items.filter((item) => item.id !== id))} /></main>;
}
