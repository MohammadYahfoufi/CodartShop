"use client";

import { useMemo, useState } from "react";
import { ProductVisual } from "@/components/product-visual";
import { PlusIcon, SearchIcon } from "@/components/icons";
import { money } from "@/lib/commerce";
import type { Product } from "@/lib/types";

type View = "all" | "trending" | "available";

export function TrendingManager({ initialProducts }: { initialProducts: Product[] }) {
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<View>("all");
  const [updatingId, setUpdatingId] = useState("");
  const [status, setStatus] = useState("");
  const trendingCount = products.filter((product) => product.featured).length;

  const visibleProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    return products.filter((product) => {
      if (view === "trending" && !product.featured) return false;
      if (view === "available" && product.featured) return false;
      return !term || `${product.title} ${product.category ?? ""} ${product.description}`.toLowerCase().includes(term);
    });
  }, [products, query, view]);

  async function toggleTrending(product: Product) {
    const featured = !product.featured;
    setUpdatingId(product.id);
    setStatus("");
    try {
      const response = await fetch(`/api/products/${product.id}/trending`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ featured }),
      });
      const result = await response.json() as Product & { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Unable to update this product.");
      setProducts((items) => items.map((item) => item.id === product.id ? result : item));
      setStatus(featured ? `${product.title} was added to Trending.` : `${product.title} was removed from Trending.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to update this product.");
    } finally {
      setUpdatingId("");
    }
  }

  return <main className="admin-workspace">
    <header className="admin-page-heading"><div><p className="eyebrow">Storefront merchandising</p><h1>Trending</h1><p>Add or remove products from the homepage Trending carousel with one click.</p></div><span className="admin-heading-count">{trendingCount} live</span></header>

    <section className="trending-admin-summary" aria-label="Trending product summary">
      <article><span>In the carousel</span><strong>{trendingCount}</strong><small>Products currently promoted</small></article>
      <article><span>Available products</span><strong>{products.length - trendingCount}</strong><small>Ready to add to Trending</small></article>
    </section>

    <section className="trending-admin-panel">
      <div className="trending-admin-toolbar">
        <label><SearchIcon /><span className="sr-only">Search products</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products or categories" /></label>
        <div role="group" aria-label="Filter products">
          {(["all", "trending", "available"] as View[]).map((item) => <button type="button" className={view === item ? "is-active" : ""} onClick={() => setView(item)} key={item}>{item === "all" ? "All products" : item === "trending" ? "Trending now" : "Not trending"}</button>)}
        </div>
      </div>
      {status && <p className="trending-admin-status" role="status">{status}</p>}
      <div className="trending-admin-grid">
        {visibleProducts.length ? visibleProducts.map((product) => <article className={product.featured ? "is-trending" : ""} key={product.id}>
          <div className="trending-admin-image"><ProductVisual src={product.image_url} alt={product.title} />{product.featured && <span>In carousel</span>}</div>
          <div className="trending-admin-copy"><small>{product.category ?? "Accessories"}</small><h2>{product.title}</h2><p>{product.description}</p><strong>{money.format(product.sale_price ?? product.price)}</strong></div>
          <button type="button" className={product.featured ? "remove" : "add"} disabled={updatingId === product.id} onClick={() => void toggleTrending(product)}>{updatingId === product.id ? <span className="spinner dark" /> : product.featured ? <><span aria-hidden="true">−</span> Remove from Trending</> : <><PlusIcon /> Add to Trending</>}</button>
        </article>) : <div className="trending-admin-empty"><h2>No products found</h2><p>Try another search or filter.</p></div>}
      </div>
    </section>
  </main>;
}
