"use client";

import Link from "next/link";
import { ChangeEvent, DragEvent, FormEvent, useEffect, useState } from "react";
import { ArrowIcon, BagIcon, CloseIcon, EditIcon, ImageIcon, PlusIcon, SearchIcon, TrashIcon } from "@/components/icons";
import { ProductVisual } from "@/components/product-visual";
import { BannerManager } from "@/components/banner-manager";
import { ConfirmDialog, ToastStack, type ToastMessage } from "@/components/feedback";
import type { AdminOrder, HeroSlide, OrderStatus, Product } from "@/lib/types";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { realtimeTopics } from "@/lib/realtime-topics";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

async function convertToWebP(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const maxDimension = 1600;
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Your browser could not process this image.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.82));
  if (!blob) throw new Error("Image conversion failed.");
  return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" });
}

export function AdminDashboard({
  initialProducts,
  initialOrders,
  favoriteCount,
  initialSlides,
  configured,
  productsOnly = false,
}: {
  initialProducts: Product[];
  initialOrders: AdminOrder[];
  favoriteCount: number;
  initialSlides: HeroSlide[];
  configured: boolean;
  productsOnly?: boolean;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [orders, setOrders] = useState(initialOrders);
  const [editing, setEditing] = useState<Product | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [category, setCategory] = useState("Accessories");
  const [stockQuantity, setStockQuantity] = useState("10");
  const [featured, setFeatured] = useState(false);
  const [specifications, setSpecifications] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [productPage, setProductPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const pageSize = 8;

  useEffect(() => () => { previews.forEach((preview) => URL.revokeObjectURL(preview)); }, [previews]);

  useEffect(() => {
    if (productsOnly) return;
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return;
    const refresh = () => { void fetch("/api/admin/orders", { cache: "no-store" }).then((response) => response.ok ? response.json() : null).then((result: { orders?: AdminOrder[] } | null) => { if (result?.orders) setOrders(result.orders); }); };
    const channel = supabase.channel(realtimeTopics.adminOrders).on("broadcast", { event: "orders-changed" }, refresh).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [productsOnly]);

  function notify(message: string, tone: ToastMessage["tone"] = "info") { setToasts((items) => [...items, { id: Date.now() + Math.random(), message, tone }]); }

  function resetForm() {
    previews.forEach((preview) => URL.revokeObjectURL(preview));
    setEditing(null);
    setTitle("");
    setDescription("");
    setPrice("");
    setSalePrice(""); setCategory("Accessories"); setStockQuantity("10"); setFeatured(false); setSpecifications("");
    setImages([]);
    setPreviews([]);
    setStatus("");
  }

  function startEdit(product: Product) {
    setEditing(product);
    setTitle(product.title);
    setDescription(product.description);
    setPrice(String(product.price));
    setSalePrice(product.sale_price == null ? "" : String(product.sale_price));
    setCategory(product.category ?? "Accessories");
    setStockQuantity(String(product.stock_quantity ?? 0));
    setFeatured(Boolean(product.featured));
    setSpecifications(Object.entries(product.specifications ?? {}).map(([key, value]) => `${key}: ${value}`).join("\n"));
    setImages([]);
    setPreviews([]);
    setStatus("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function processImages(selectedFiles: File[]) {
    const selected = selectedFiles.slice(0, 8);
    if (!selected.length) return;
    if (selected.some((file) => !file.type.startsWith("image/"))) {
      setStatus("Please choose an image file.");
      return;
    }

    setStatus("Optimizing image…");
    try {
      const converted = await Promise.all(selected.map(convertToWebP));
      previews.forEach((preview) => URL.revokeObjectURL(preview));
      setImages(converted);
      setPreviews(converted.map((file) => URL.createObjectURL(file)));
      setStatus(`${converted.length} ${converted.length === 1 ? "image" : "images"} optimized and ready.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to process image.");
    }
  }

  function pickImage(event: ChangeEvent<HTMLInputElement>) {
    const selected = [...(event.target.files ?? [])];
    if (selected.length) void processImages(selected);
    event.target.value = "";
  }

  function dropImage(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    const selected = [...event.dataTransfer.files];
    if (selected.length) void processImages(selected);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing && !images.length) {
      setStatus("Choose a product image.");
      return;
    }

    setSaving(true);
    setStatus(editing ? "Updating product…" : "Publishing product…");
    const formData = new FormData();
    formData.set("title", title);
    formData.set("description", description);
    formData.set("price", price);
    formData.set("sale_price", salePrice); formData.set("category", category); formData.set("stock_quantity", stockQuantity); formData.set("featured", String(featured));
    formData.set("specifications", JSON.stringify(Object.fromEntries(specifications.split("\n").map((line) => line.split(":" as const)).map(([key, ...value]) => [key?.trim(), value.join(":").trim()]).filter(([key, value]) => key && value))));
    images.forEach((image) => formData.append("images", image));

    try {
      const response = await fetch(editing ? `/api/products/${editing.id}` : "/api/products", {
        method: editing ? "PATCH" : "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to save product.");
      setProducts((items) => editing ? items.map((item) => item.id === result.id ? result : item) : [result, ...items]);
      const successMessage = editing ? "Product updated successfully." : "Product and image published successfully.";
      resetForm();
      setStatus(""); notify(successMessage, "success");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save product.");
    } finally {
      setSaving(false);
    }
  }

  async function removeProduct(product: Product) {
    setDeletingId(product.id);
    try {
      const response = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? "Unable to delete product.");
      }
      setProducts((items) => items.filter((item) => item.id !== product.id));
      if (editing?.id === product.id) resetForm();
      setDeleteTarget(null); notify("Product deleted.", "success");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to delete product.", "error");
    } finally {
      setDeletingId("");
    }
  }

  async function duplicateProduct(product: Product) {
    try { const response = await fetch(`/api/products/${product.id}`, { method: "POST" }); const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Unable to duplicate product."); setProducts((items) => [result, ...items]); notify("Product duplicated.", "success"); }
    catch (error) { notify(error instanceof Error ? error.message : "Unable to duplicate product.", "error"); }
  }

  async function updateOrderStatus(id: string, status: OrderStatus) {
    setUpdatingOrderId(id);
    try {
      const response = await fetch(`/api/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to update order.");
      setOrders((items) => items.map((order) => order.id === id ? { ...order, status } : order));
    } catch (error) {
      notify(error instanceof Error ? error.message : "Unable to update order.", "error");
    } finally {
      setUpdatingOrderId("");
    }
  }

  const matchingProducts = products.filter((product) => `${product.title} ${product.category ?? ""}`.toLowerCase().includes(productSearch.trim().toLowerCase()));
  const productPages = Math.max(1, Math.ceil(matchingProducts.length / pageSize));
  const visibleProducts = matchingProducts.slice((Math.min(productPage, productPages) - 1) * pageSize, Math.min(productPage, productPages) * pageSize);

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div><p className="eyebrow">Codart workspace</p><h1>Product administration</h1><p>Create and maintain the storefront collection.</p></div>
        <Link href="/" className="secondary-button">View storefront <ArrowIcon /></Link>
      </header>

      {!productsOnly && <section className="admin-stats" aria-label="Store overview">
        <div><span>Products</span><strong>{products.length}</strong></div>
        <div><span>Orders</span><strong>{orders.length}</strong></div>
        <div><span>Pending</span><strong>{orders.filter((order) => order.status === "pending").length}</strong></div>
        <div><span>Saved favorites</span><strong>{favoriteCount}</strong></div>
      </section>}

      {!configured && <div className="setup-notice"><strong>Local storage mode</strong><span>Products and images can be added locally. Connect Supabase before production deployment.</span></div>}
      <div className="security-notice"><strong>Protected workspace</strong><span>Catalog changes are verified by the server before Supabase is updated.</span></div>

      <div className="admin-layout">
        <section className="admin-form-panel">
          <div className="panel-heading"><div><p className="eyebrow">{editing ? "Edit entry" : "New entry"}</p><h2>{editing ? editing.title : "Add a product"}</h2></div>{editing && <button className="icon-button" onClick={resetForm} aria-label="Cancel edit"><CloseIcon /></button>}</div>
          <form onSubmit={submit}>
            <label className="field"><span>Product title</span><input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Arc Mechanical" /></label>
            <label className="field"><span>Description</span><textarea required maxLength={600} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What makes this product worth considering?" /></label>
            <div className="admin-field-grid"><label className="field"><span>Category</span><input required maxLength={80} value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Accessories" /></label><label className="field"><span>Stock quantity</span><input required min="0" step="1" type="number" value={stockQuantity} onChange={(event) => setStockQuantity(event.target.value)} /></label></div>
            <div className="admin-field-grid"><label className="field"><span>Regular price (USD)</span><div className="price-input"><b>$</b><input required min="0" step="0.01" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="0.00" /></div></label><label className="field"><span>Sale price <small>optional</small></span><div className="price-input"><b>$</b><input min="0" step="0.01" inputMode="decimal" value={salePrice} onChange={(event) => setSalePrice(event.target.value)} placeholder="0.00" /></div></label></div>
            <label className="admin-check-field"><input type="checkbox" checked={featured} onChange={(event) => setFeatured(event.target.checked)} /><span>Feature this product on the storefront</span></label>
            <label className="field"><span>Specifications <small>one “Name: Value” per line</small></span><textarea rows={5} value={specifications} onChange={(event) => setSpecifications(event.target.value)} placeholder={"Power: 65W\nWarranty: 1 year\nColor: Black"} /></label>
            <div className="field"><span>Product images {editing && <small>· leave empty to keep gallery</small>}</span><label
              className={`upload-zone ${isDragging ? "is-dragging" : ""}`}
              onDragEnter={(event) => {
                event.preventDefault();
                setIsDragging(true);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
                setIsDragging(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setIsDragging(false);
                }
              }}
              onDrop={dropImage}
            >
              <input type="file" accept="image/*" multiple onChange={pickImage} />
              {previews.length || editing?.image_url ? <div className="upload-preview-grid">{(previews.length ? previews : (editing?.images?.map((item) => item.url) ?? [editing?.image_url ?? ""])).map((src) => <span className="upload-preview" key={src}><ProductVisual src={src} alt="Product preview" /></span>)}</div> : <><ImageIcon /><strong>Drop or choose up to 8 images</strong><small>Converted to WebP automatically · max 1600px</small></>}
            </label></div>
            {status && <p className="form-status" role="status">{status}</p>}
            <button className="admin-submit" type="submit" disabled={saving}>{saving ? <span className="spinner" /> : editing ? <EditIcon /> : <PlusIcon />}{saving ? "Saving…" : editing ? "Update product" : "Publish product"}</button>
          </form>
        </section>

        <section className="admin-list-panel">
          <div className="panel-heading"><div><p className="eyebrow">Live catalog</p><h2>{matchingProducts.length} {matchingProducts.length === 1 ? "product" : "products"}</h2></div></div>
          <label className="admin-list-search"><SearchIcon /><input value={productSearch} onChange={(event) => { setProductSearch(event.target.value); setProductPage(1); }} placeholder="Search products or categories" /></label>
          <div className="admin-products">
            {visibleProducts.length === 0 ? <div className="admin-empty"><ImageIcon /><h3>No products found</h3><p>Try another search or publish your first product.</p></div> : visibleProducts.map((product) => (
              <article className="admin-product" key={product.id}>
                <div className="admin-product-image"><ProductVisual src={product.image_url} alt={product.title} /></div>
                <div className="admin-product-copy"><span className="admin-product-meta">{product.category ?? "Accessories"} · {product.stock_quantity ?? 0} in stock</span><h3>{product.title}</h3><p>{product.description}</p><strong>{money.format(product.sale_price ?? product.price)}</strong>{(product.stock_quantity ?? 0) <= 5 && <em className="inventory-warning">{(product.stock_quantity ?? 0) === 0 ? "Out of stock" : "Low stock"}</em>}</div>
                <div className="admin-product-actions"><button onClick={() => startEdit(product)} aria-label={`Edit ${product.title}`}><EditIcon /></button><button onClick={() => void duplicateProduct(product)} aria-label={`Duplicate ${product.title}`} title="Duplicate"><PlusIcon /></button><button className="danger-action" onClick={() => setDeleteTarget(product)} disabled={deletingId === product.id} aria-label={`Delete ${product.title}`}>{deletingId === product.id ? <span className="spinner dark" /> : <TrashIcon />}</button></div>
              </article>
            ))}
          </div>
          {productPages > 1 && <nav className="admin-pagination" aria-label="Product pages"><button type="button" disabled={productPage <= 1} onClick={() => setProductPage((page) => page - 1)}>Previous</button><span>Page {Math.min(productPage, productPages)} of {productPages}</span><button type="button" disabled={productPage >= productPages} onClick={() => setProductPage((page) => page + 1)}>Next</button></nav>}
        </section>
      </div>

      {!productsOnly && <BannerManager initialSlides={initialSlides} />}

      {!productsOnly && <section className="admin-orders-panel">
        <div className="panel-heading"><div><p className="eyebrow">Customer activity</p><h2>Recent orders</h2></div><span>{orders.length} total</span></div>
        <div className="admin-orders">
          {orders.length === 0 ? (
            <div className="admin-empty"><BagIcon /><h3>No orders yet</h3><p>Saved checkout orders will appear here.</p></div>
          ) : orders.map((order) => (
            <article className="admin-order" key={order.id}>
              <div className="admin-order-heading">
                <div><small>#{order.id.slice(0, 8).toUpperCase()}</small><h3>{order.customer_name}</h3><a href={`tel:${order.customer_phone}`}>{order.customer_phone}</a></div>
                <div><strong>{money.format(order.total)}</strong><time dateTime={order.created_at}>{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(order.created_at))}</time></div>
              </div>
              <ul>{order.order_items.map((item) => <li key={item.id}><span>{item.product_title} × {item.quantity}</span><strong>{money.format(Number(item.unit_price) * item.quantity)}</strong></li>)}</ul>
              {order.customer_note && <p className="admin-order-note">{order.customer_note}</p>}
              <label className="order-status"><span>Status</span><select className={`status-select status-${order.status}`} value={order.status} disabled={updatingOrderId === order.id || !configured} onChange={(event) => void updateOrderStatus(order.id, event.target.value as OrderStatus)}><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="shipped">On the way</option><option value="delivered">Delivered</option><option value="cancelled">Cancelled</option></select></label>
            </article>
          ))}
        </div>
      </section>}
      <ToastStack toasts={toasts} dismiss={(id) => setToasts((items) => items.filter((item) => item.id !== id))} />
      {deleteTarget && <ConfirmDialog title={`Delete ${deleteTarget.title}?`} message="The product record and every image in its Supabase gallery will be permanently removed." busy={deletingId === deleteTarget.id} onCancel={() => setDeleteTarget(null)} onConfirm={() => void removeProduct(deleteTarget)} />}
    </main>
  );
}
