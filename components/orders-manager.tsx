"use client";

import { useState } from "react";
import type { AdminOrder, OrderStatus } from "@/lib/types";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function OrdersManager({ initialOrders }: { initialOrders: AdminOrder[] }) {
  const [orders, setOrders] = useState(initialOrders);
  const [updating, setUpdating] = useState("");
  async function updateStatus(id: string, status: OrderStatus) {
    setUpdating(id);
    try {
      const response = await fetch(`/api/orders/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to update order.");
      setOrders((items) => items.map((order) => order.id === id ? { ...order, status } : order));
    } catch (error) { alert(error instanceof Error ? error.message : "Unable to update order."); }
    finally { setUpdating(""); }
  }
  return <main className="admin-workspace"><header className="admin-page-heading"><div><p className="eyebrow">Fulfilment</p><h1>Orders</h1><p>Review customer details, items, and fulfilment status.</p></div><span className="admin-heading-count">{orders.length} total</span></header><section className="orders-page-list">{orders.length ? orders.map((order) => <article className="order-row" key={order.id}><div className="order-row-id"><small>Order</small><strong>#{order.id.slice(0, 8).toUpperCase()}</strong><time>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.created_at))}</time></div><div className="order-row-customer"><strong>{order.customer_name}</strong><a href={`tel:${order.customer_phone}`}>{order.customer_phone}</a>{order.customer_note && <p>{order.customer_note}</p>}</div><div className="order-row-items">{order.order_items.map((item) => <span key={item.id}>{item.product_title} × {item.quantity}</span>)}</div><strong className="order-row-total">{money.format(Number(order.total))}</strong><select value={order.status} disabled={updating === order.id} onChange={(event) => void updateStatus(order.id, event.target.value as OrderStatus)}><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="fulfilled">Fulfilled</option><option value="cancelled">Cancelled</option></select></article>) : <div className="dashboard-empty">Orders will appear here after checkout.</div>}</section></main>;
}
