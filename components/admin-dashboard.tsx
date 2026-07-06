"use client";

import Link from "next/link";
import { ChangeEvent, DragEvent, FormEvent, useEffect, useState } from "react";
import { ArrowIcon, CloseIcon, EditIcon, ImageIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { ProductVisual } from "@/components/product-visual";
import type { Product } from "@/lib/types";

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

export function AdminDashboard({ initialProducts, configured }: { initialProducts: Product[]; configured: boolean }) {
  const [products, setProducts] = useState(initialProducts);
  const [editing, setEditing] = useState<Product | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function resetForm() {
    if (preview) URL.revokeObjectURL(preview);
    setEditing(null);
    setTitle("");
    setDescription("");
    setPrice("");
    setImage(null);
    setPreview("");
    setStatus("");
  }

  function startEdit(product: Product) {
    setEditing(product);
    setTitle(product.title);
    setDescription(product.description);
    setPrice(String(product.price));
    setImage(null);
    setPreview("");
    setStatus("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function processImage(selected: File) {
    if (!selected.type.startsWith("image/")) {
      setStatus("Please choose an image file.");
      return;
    }

    setStatus("Optimizing image…");
    try {
      const webp = await convertToWebP(selected);
      if (preview) URL.revokeObjectURL(preview);
      setImage(webp);
      setPreview(URL.createObjectURL(webp));
      const saved = Math.max(0, Math.round((1 - webp.size / selected.size) * 100));
      setStatus(`Ready as WebP · ${(webp.size / 1024).toFixed(0)} KB${saved > 0 ? ` · ${saved}% smaller` : ""}`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to process image.");
    }
  }

  function pickImage(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (selected) void processImage(selected);
    event.target.value = "";
  }

  function dropImage(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    const selected = event.dataTransfer.files?.[0];
    if (selected) void processImage(selected);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured) {
      setStatus("Connect Supabase before managing products.");
      return;
    }
    if (!editing && !image) {
      setStatus("Choose a product image.");
      return;
    }

    setSaving(true);
    setStatus(editing ? "Updating product…" : "Publishing product…");
    const formData = new FormData();
    formData.set("title", title);
    formData.set("description", description);
    formData.set("price", price);
    if (image) formData.set("image", image);

    try {
      const response = await fetch(editing ? `/api/products/${editing.id}` : "/api/products", {
        method: editing ? "PATCH" : "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to save product.");
      setProducts((items) => editing ? items.map((item) => item.id === result.id ? result : item) : [result, ...items]);
      resetForm();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to save product.");
    } finally {
      setSaving(false);
    }
  }

  async function removeProduct(product: Product) {
    if (!configured || !confirm(`Delete “${product.title}”? This cannot be undone.`)) return;
    setDeletingId(product.id);
    try {
      const response = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error ?? "Unable to delete product.");
      }
      setProducts((items) => items.filter((item) => item.id !== product.id));
      if (editing?.id === product.id) resetForm();
    } catch (error) {
      alert(error instanceof Error ? error.message : "Unable to delete product.");
    } finally {
      setDeletingId("");
    }
  }

  return (
    <main className="admin-shell">
      <header className="admin-header">
        <div><p className="eyebrow">Codart workspace</p><h1>Product administration</h1><p>Create and maintain the storefront collection.</p></div>
        <Link href="/" className="secondary-button">View storefront <ArrowIcon /></Link>
      </header>

      {!configured && <div className="setup-notice"><strong>Supabase setup required</strong><span>The sample catalog is read-only. Add your Supabase URL and service role key to <code>.env.local</code>, then run the included SQL setup.</span></div>}
      <div className="security-notice"><strong>Development-only admin</strong><span>This route has no authentication, as requested. Add access control before exposing it publicly.</span></div>

      <div className="admin-layout">
        <section className="admin-form-panel">
          <div className="panel-heading"><div><p className="eyebrow">{editing ? "Edit entry" : "New entry"}</p><h2>{editing ? editing.title : "Add a product"}</h2></div>{editing && <button className="icon-button" onClick={resetForm} aria-label="Cancel edit"><CloseIcon /></button>}</div>
          <form onSubmit={submit}>
            <label className="field"><span>Product title</span><input required maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Arc Mechanical" /></label>
            <label className="field"><span>Description</span><textarea required maxLength={600} rows={5} value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What makes this product worth considering?" /></label>
            <label className="field"><span>Price (USD)</span><div className="price-input"><b>$</b><input required min="0" step="0.01" inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="0.00" /></div></label>
            <div className="field"><span>Product image {editing && <small>· optional when editing</small>}</span><label
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
              <input type="file" accept="image/*" onChange={pickImage} />
              {preview || editing?.image_url ? <div className="upload-preview"><ProductVisual src={preview || editing?.image_url || ""} alt="Product preview" /><span>Choose a different image</span></div> : <><ImageIcon /><strong>Drop or choose an image</strong><small>Converted to WebP automatically · max 1600px</small></>}
            </label></div>
            {status && <p className="form-status" role="status">{status}</p>}
            <button className="admin-submit" type="submit" disabled={saving || !configured}>{saving ? <span className="spinner" /> : editing ? <EditIcon /> : <PlusIcon />}{saving ? "Saving…" : editing ? "Update product" : "Publish product"}</button>
          </form>
        </section>

        <section className="admin-list-panel">
          <div className="panel-heading"><div><p className="eyebrow">Live catalog</p><h2>{products.length} {products.length === 1 ? "product" : "products"}</h2></div></div>
          <div className="admin-products">
            {products.length === 0 ? <div className="admin-empty"><ImageIcon /><h3>No products yet</h3><p>Your first product will appear here.</p></div> : products.map((product) => (
              <article className="admin-product" key={product.id}>
                <div className="admin-product-image"><ProductVisual src={product.image_url} alt={product.title} /></div>
                <div className="admin-product-copy"><h3>{product.title}</h3><p>{product.description}</p><strong>{money.format(product.price)}</strong></div>
                <div className="admin-product-actions"><button onClick={() => startEdit(product)} disabled={!configured} aria-label={`Edit ${product.title}`}><EditIcon /></button><button className="danger-action" onClick={() => removeProduct(product)} disabled={!configured || deletingId === product.id} aria-label={`Delete ${product.title}`}>{deletingId === product.id ? <span className="spinner dark" /> : <TrashIcon />}</button></div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
