"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { ArrowIcon, ImageIcon, PlusIcon, TrashIcon } from "@/components/icons";
import { ProductVisual } from "@/components/product-visual";
import type { HeroSlide } from "@/lib/types";

async function toWebP(file: File) {
  const bitmap = await createImageBitmap(file);
  const width = Math.min(2000, bitmap.width);
  const scale = width / bitmap.width;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to process this image.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", .86));
  if (!blob) throw new Error("Image conversion failed.");
  return new File([blob], "banner.webp", { type: "image/webp" });
}

export function BannerManager({ initialSlides }: { initialSlides: HeroSlide[] }) {
  const [slides, setSlides] = useState(initialSlides);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [ctaLabel, setCtaLabel] = useState("Shop now");
  const [ctaHref, setCtaHref] = useState("/#products");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  async function pickImage(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    if (!selected) return;
    setStatus("Optimizing banner…");
    try {
      const optimized = await toWebP(selected);
      if (preview) URL.revokeObjectURL(preview);
      setImage(optimized);
      setPreview(URL.createObjectURL(optimized));
      setStatus("Banner ready to publish.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to process image.");
    }
  }

  async function createSlide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!image) return setStatus("Choose a wide banner image first.");
    setSaving(true);
    setStatus("Publishing banner…");
    const form = new FormData();
    form.set("title", title);
    form.set("subtitle", subtitle);
    form.set("cta_label", ctaLabel);
    form.set("cta_href", ctaHref);
    form.set("sort_order", String(slides.length));
    form.set("image", image);
    try {
      const response = await fetch("/api/slides", { method: "POST", body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Unable to publish banner.");
      setSlides((items) => [...items, result]);
      setTitle(""); setSubtitle(""); setCtaLabel("Shop now"); setCtaHref("/#products"); setImage(null);
      if (preview) URL.revokeObjectURL(preview);
      setPreview("");
      setStatus("Banner published. Refresh the storefront to see it.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Unable to publish banner.");
    } finally { setSaving(false); }
  }

  async function patchSlide(slide: HeroSlide, updates: Partial<HeroSlide>) {
    const response = await fetch(`/api/slides/${slide.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) });
    const result = await response.json();
    if (!response.ok) return alert(result.error ?? "Unable to update banner.");
    setSlides((items) => items.map((item) => item.id === slide.id ? result : item));
  }

  async function removeSlide(slide: HeroSlide) {
    if (!confirm(`Delete banner “${slide.title}”?`)) return;
    const response = await fetch(`/api/slides/${slide.id}`, { method: "DELETE" });
    if (!response.ok) return alert("Unable to delete banner.");
    setSlides((items) => items.filter((item) => item.id !== slide.id));
  }

  return (
    <section className="banner-manager">
      <div className="panel-heading"><div><p className="eyebrow">Homepage editor</p><h2>Hero slideshow</h2></div><span>Up to 5 slides</span></div>
      <div className="banner-manager-layout">
        <form className="banner-form" onSubmit={createSlide}>
          <label className="field"><span>Headline</span><input required maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="A clear campaign headline" /></label>
          <label className="field"><span>Supporting text</span><textarea maxLength={240} rows={3} value={subtitle} onChange={(event) => setSubtitle(event.target.value)} placeholder="A short reason to explore this feature" /></label>
          <div className="banner-fields"><label className="field"><span>Button label</span><input required maxLength={40} value={ctaLabel} onChange={(event) => setCtaLabel(event.target.value)} /></label><label className="field"><span>Button link</span><input required value={ctaHref} onChange={(event) => setCtaHref(event.target.value)} /></label></div>
          <label className="banner-upload"><input type="file" accept="image/*" onChange={pickImage} />{preview ? <ProductVisual src={preview} alt="Banner preview" /> : <><ImageIcon width={27} height={27} style={{ width: 27, height: 27, maxWidth: 27, maxHeight: 27 }} /><strong>Choose a wide image</strong><span>Recommended 2000 × 1100 or wider</span></>}</label>
          {status && <p className="form-status" role="status">{status}</p>}
          <button className="admin-submit" type="submit" disabled={saving || slides.length >= 5}>{saving ? "Publishing…" : <><PlusIcon /> Publish banner</>}</button>
        </form>
        <div className="banner-list">
          {slides.length ? [...slides].sort((a, b) => a.sort_order - b.sort_order).map((slide) => <article className={`banner-list-item ${slide.active ? "" : "is-disabled"}`} key={slide.id}><div className="banner-list-image"><ProductVisual src={slide.image_url} alt="" /></div><div><small>Slide {slide.sort_order + 1}</small><h3>{slide.title}</h3><p>{slide.subtitle}</p><div className="banner-actions"><button type="button" onClick={() => void patchSlide(slide, { active: !slide.active })}>{slide.active ? "Hide" : "Show"}</button><a href={slide.cta_href} target="_blank">Preview link <ArrowIcon /></a><button type="button" className="danger-action" onClick={() => void removeSlide(slide)}><TrashIcon /></button></div></div></article>) : <div className="admin-empty"><ImageIcon /><h3>No custom banners yet</h3><p>The storefront is using its designed fallback hero.</p></div>}
        </div>
      </div>
    </section>
  );
}
