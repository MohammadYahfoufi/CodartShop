"use client";

import { FormEvent, useMemo, useState } from "react";
import { MinusIcon, PlusIcon, SearchIcon, TrashIcon } from "@/components/icons";
import { ProductVisual } from "@/components/product-visual";
import { money } from "@/lib/commerce";
import type { Product } from "@/lib/types";

type BasketItem = { product: Product; quantity: number };

function salePrice(product: Product) {
  return Number(product.sale_price != null && product.sale_price < product.price ? product.sale_price : product.price);
}

export function InPersonSale({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [query, setQuery] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "whish-money">("cash");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  const visibleProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products.filter((product) => !term || `${product.title} ${product.category ?? ""} ${product.description}`.toLowerCase().includes(term));
  }, [products, query]);
  const itemCount = basket.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = basket.reduce((sum, item) => sum + salePrice(item.product) * item.quantity, 0);

  function changeQuantity(product: Product, amount: number) {
    const stock = product.stock_quantity ?? 0;
    setBasket((items) => {
      const existing = items.find((item) => item.product.id === product.id);
      if (!existing && amount > 0 && stock > 0) return [...items, { product, quantity: 1 }];
      return items.map((item) => item.product.id === product.id ? { ...item, quantity: Math.min(stock, item.quantity + amount) } : item).filter((item) => item.quantity > 0);
    });
    setStatus(null);
  }

  async function completeSale(event: FormEvent) {
    event.preventDefault();
    if (!basket.length) return;
    setSubmitting(true);
    setStatus(null);
    try {
      const response = await fetch("/api/admin/in-person-sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName, customerPhone, paymentMethod, note, items: basket.map((item) => ({ productId: item.product.id, quantity: item.quantity })) }),
      });
      const result = await response.json() as { id?: string; total?: number; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error ?? "Unable to complete the sale.");
      const sold = new Map(basket.map((item) => [item.product.id, item.quantity]));
      setProducts((items) => items.map((product) => sold.has(product.id) ? { ...product, stock_quantity: Math.max(0, (product.stock_quantity ?? 0) - sold.get(product.id)!) } : product));
      setBasket([]);
      setCustomerName("");
      setCustomerPhone("");
      setNote("");
      setStatus({ tone: "success", message: `Sale #${result.id.slice(0, 8).toUpperCase()} recorded for ${money.format(result.total ?? 0)}.` });
    } catch (error) {
      setStatus({ tone: "error", message: error instanceof Error ? error.message : "Unable to complete the sale." });
    } finally {
      setSubmitting(false);
    }
  }

  return <main className="admin-workspace in-person-sale-page">
    <header className="admin-page-heading"><div><p className="eyebrow">Point of sale</p><h1>In-person sale</h1><p>Record a walk-in purchase, update stock, and include it in orders and sales reports.</p></div><span className="admin-heading-count">{itemCount} {itemCount === 1 ? "item" : "items"}</span></header>
    {status && <p className={`in-person-status is-${status.tone}`} role="status">{status.message}</p>}
    <div className="in-person-layout">
      <section className="in-person-catalog">
        <div className="panel-heading"><div><p className="eyebrow">Inventory</p><h2>Choose products</h2></div></div>
        <label className="in-person-search"><SearchIcon /><span className="sr-only">Search inventory</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products or categories" /></label>
        <div className="in-person-product-list">
          {visibleProducts.length ? visibleProducts.map((product) => {
            const quantity = basket.find((item) => item.product.id === product.id)?.quantity ?? 0;
            const stock = product.stock_quantity ?? 0;
            return <article key={product.id}>
              <div className="in-person-product-image"><ProductVisual src={product.image_url} alt={product.title} /></div>
              <div className="in-person-product-copy"><small>{product.category ?? "Accessories"}</small><h3>{product.title}</h3><span>{money.format(salePrice(product))} · {stock} in stock</span></div>
              {quantity ? <div className="in-person-stepper"><button type="button" onClick={() => changeQuantity(product, -1)} aria-label={`Remove one ${product.title}`}><MinusIcon /></button><strong>{quantity}</strong><button type="button" onClick={() => changeQuantity(product, 1)} disabled={quantity >= stock} aria-label={`Add one ${product.title}`}><PlusIcon /></button></div> : <button type="button" className="in-person-add" disabled={stock <= 0} onClick={() => changeQuantity(product, 1)}>{stock <= 0 ? "Out of stock" : <><PlusIcon /> Add</>}</button>}
            </article>;
          }) : <div className="in-person-empty">No products match your search.</div>}
        </div>
      </section>

      <form className="in-person-checkout" onSubmit={completeSale}>
        <div className="panel-heading"><div><p className="eyebrow">Current sale</p><h2>Basket</h2></div><strong>{money.format(subtotal)}</strong></div>
        <div className="in-person-basket">
          {basket.length ? basket.map((item) => <article key={item.product.id}><div><strong>{item.product.title}</strong><small>{money.format(salePrice(item.product))} × {item.quantity}</small></div><b>{money.format(salePrice(item.product) * item.quantity)}</b><button type="button" onClick={() => setBasket((items) => items.filter((entry) => entry.product.id !== item.product.id))} aria-label={`Remove ${item.product.title}`}><TrashIcon /></button></article>) : <div className="in-person-basket-empty"><strong>No products added</strong><span>Select products from the inventory list.</span></div>}
        </div>
        <div className="in-person-total"><span>Items <b>{itemCount}</b></span><strong>Total <b>{money.format(subtotal)}</b></strong></div>
        <div className="in-person-fields">
          <label><span>Customer name <small>optional</small></span><input value={customerName} onChange={(event) => setCustomerName(event.target.value)} maxLength={120} placeholder="Walk-in customer" /></label>
          <label><span>Phone <small>optional</small></span><input value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} maxLength={40} placeholder="Customer phone" type="tel" /></label>
          <label><span>Payment method</span><select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as "cash" | "whish-money")}><option value="cash">Cash</option><option value="whish-money">Whish Money</option></select></label>
          <label><span>Note <small>optional</small></span><textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={900} rows={3} placeholder="Color, discount reason, or other details" /></label>
        </div>
        <button className="in-person-complete" type="submit" disabled={!basket.length || submitting}>{submitting ? <span className="spinner" /> : null}{submitting ? "Recording sale…" : `Complete sale · ${money.format(subtotal)}`}</button>
      </form>
    </div>
  </main>;
}
