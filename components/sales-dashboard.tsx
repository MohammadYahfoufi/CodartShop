import type { AdminOrder } from "@/lib/types";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

type SalesOrder = Pick<AdminOrder, "id" | "total" | "status" | "created_at" | "order_items">;

export function SalesDashboard({ orders }: { orders: SalesOrder[] }) {
  const valid = orders.filter((order) => order.status !== "cancelled");
  const total = valid.reduce((sum, order) => sum + Number(order.total), 0);
  const fulfilled = valid.filter((order) => order.status === "delivered").reduce((sum, order) => sum + Number(order.total), 0);
  const average = valid.length ? total / valid.length : 0;
  const days = Array.from({ length: 7 }, (_, offset) => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - (6 - offset));
    const next = new Date(date);
    next.setDate(next.getDate() + 1);
    const value = valid.filter((order) => {
      const created = new Date(order.created_at);
      return created >= date && created < next;
    }).reduce((sum, order) => sum + Number(order.total), 0);
    return { label: new Intl.DateTimeFormat("en", { weekday: "short" }).format(date), value };
  });
  const maximum = Math.max(1, ...days.map((day) => day.value));
  const productTotals = new Map<string, { title: string; quantity: number; revenue: number }>();
  for (const order of valid) {
    for (const item of order.order_items) {
      const key = item.product_title.trim().toLowerCase();
      const current = productTotals.get(key) ?? { title: item.product_title, quantity: 0, revenue: 0 };
      current.quantity += Number(item.quantity);
      current.revenue += Number(item.unit_price) * Number(item.quantity);
      productTotals.set(key, current);
    }
  }
  const topProducts = [...productTotals.values()]
    .sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue || a.title.localeCompare(b.title))
    .slice(0, 10);
  const topQuantity = Math.max(1, ...topProducts.map((product) => product.quantity));

  return <main className="admin-workspace">
    <header className="admin-page-heading"><div><p className="eyebrow">Performance</p><h1>Sales</h1><p>Revenue and order performance from saved checkout orders.</p></div></header>
    <section className="dashboard-metrics sales-metrics"><article><span>Total revenue</span><strong>{money.format(total)}</strong><small>{valid.length} valid orders</small></article><article><span>Delivered revenue</span><strong>{money.format(fulfilled)}</strong><small>Completed sales</small></article><article><span>Average order</span><strong>{money.format(average)}</strong><small>Per non-cancelled order</small></article></section>
    <section className="sales-chart-panel"><div className="panel-heading"><div><p className="eyebrow">Last 7 days</p><h2>Daily revenue</h2></div></div><div className="sales-bars">{days.map((day) => <div key={day.label}><span className="sales-bar-value">{day.value ? money.format(day.value) : "—"}</span><div className="sales-bar-track"><i style={{ height: `${Math.max(day.value ? 8 : 2, (day.value / maximum) * 100)}%` }} /></div><strong>{day.label}</strong></div>)}</div></section>
    <section className="top-products-panel">
      <div className="panel-heading"><div><p className="eyebrow">Product performance</p><h2>Top 10 products sold</h2></div><span>Ordered by quantity</span></div>
      {topProducts.length ? <div className="top-products-list">{topProducts.map((product, index) => <article key={product.title}><span className="top-product-rank">{String(index + 1).padStart(2, "0")}</span><div className="top-product-name"><strong>{product.title}</strong><i><b style={{ width: `${Math.max(4, product.quantity / topQuantity * 100)}%` }} /></i></div><strong className="top-product-quantity">{product.quantity}<small> sold</small></strong><span className="top-product-revenue">{money.format(product.revenue)}</span></article>)}</div> : <div className="dashboard-empty">Product sales will appear after the first completed order.</div>}
    </section>
  </main>;
}
