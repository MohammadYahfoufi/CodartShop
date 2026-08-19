import Link from "next/link";
import type { AdminOrder } from "@/lib/types";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

export function AdminOverview({ productCount, favoriteCount, orders }: { productCount: number; favoriteCount: number; orders: AdminOrder[] }) {
  const validOrders = orders.filter((order) => order.status !== "cancelled");
  const revenue = validOrders.reduce((sum, order) => sum + Number(order.total), 0);
  const pending = orders.filter((order) => order.status === "pending").length;
  return (
    <main className="admin-workspace">
      <header className="admin-page-heading"><div><p className="eyebrow">Store overview</p><h1>Dashboard</h1><p>A clear view of what needs your attention today.</p></div><Link className="secondary-button" href="/admin/products">Add product</Link></header>
      <section className="dashboard-metrics">
        <article><span>Revenue</span><strong>{money.format(revenue)}</strong><small>Non-cancelled orders</small></article>
        <article><span>Orders</span><strong>{orders.length}</strong><small>{pending} waiting for review</small></article>
        <article><span>Products</span><strong>{productCount}</strong><small>Published catalog items</small></article>
        <article><span>Favorites</span><strong>{favoriteCount}</strong><small>Total saved products</small></article>
      </section>
      <div className="dashboard-grid">
        <section className="dashboard-panel"><div className="panel-heading"><div><p className="eyebrow">Latest activity</p><h2>Recent orders</h2></div><Link href="/admin/orders">View all →</Link></div>{orders.slice(0, 5).length ? <div className="dashboard-order-list">{orders.slice(0, 5).map((order) => <Link href="/admin/orders" key={order.id}><span><small>#{order.id.slice(0, 8).toUpperCase()}</small><strong>{order.customer_name}</strong></span><span><b>{money.format(Number(order.total))}</b><em className={`status-${order.status}`}>{order.status}</em></span></Link>)}</div> : <div className="dashboard-empty">No orders have been placed yet.</div>}</section>
        <section className="dashboard-panel quick-actions"><div className="panel-heading"><div><p className="eyebrow">Manage</p><h2>Quick actions</h2></div></div><Link href="/admin/products"><strong>Add a product</strong><span>Upload an image, price, and description →</span></Link><Link href="/admin/banners"><strong>Update homepage</strong><span>Create or hide slideshow banners →</span></Link><Link href="/admin/sales"><strong>Review sales</strong><span>See revenue and order performance →</span></Link></section>
      </div>
    </main>
  );
}
