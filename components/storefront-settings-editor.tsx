"use client";

import { ChangeEvent, FormEvent, useState } from "react";
import { ImageIcon } from "@/components/icons";
import { ToastStack, type ToastMessage } from "@/components/feedback";
import type { StorefrontSettings } from "@/lib/types";

type SettingKey = keyof StorefrontSettings;

const groups: Array<{ title: string; description: string; fields: Array<{ key: SettingKey; label: string; multiline?: boolean; hint?: string }> }> = [
  { title: "Header navigation", description: "Labels shown across the top of the storefront.", fields: [
    { key: "site_name", label: "Store name" }, { key: "header_shop_label", label: "Shop link" }, { key: "header_story_label", label: "Story link" },
    { key: "header_contact_label", label: "Contact link" }, { key: "header_track_label", label: "Track order" }, { key: "header_saved_label", label: "Saved items" }, { key: "header_cart_label", label: "Cart" },
  ] },
  { title: "Fallback hero", description: "Used whenever no active homepage banner is published.", fields: [
    { key: "hero_eyebrow", label: "Small heading" }, { key: "fallback_hero_title", label: "Main headline" }, { key: "fallback_hero_subtitle", label: "Supporting text", multiline: true },
    { key: "fallback_hero_cta_label", label: "Button label" }, { key: "fallback_hero_cta_href", label: "Button link", hint: "Example: /#products" },
  ] },
  { title: "Product collection", description: "The heading and search copy above the product grid.", fields: [
    { key: "catalog_eyebrow", label: "Small heading" }, { key: "catalog_title", label: "Section title" }, { key: "catalog_search_placeholder", label: "Search placeholder" },
  ] },
  { title: "Story section", description: "The blue and purple statement above the footer.", fields: [
    { key: "story_eyebrow", label: "Small heading" }, { key: "story_title", label: "Main title", multiline: true }, { key: "story_body", label: "Supporting text", multiline: true },
  ] },
  { title: "Footer and contact", description: "Brand message, footer links, and WhatsApp contact copy.", fields: [
    { key: "footer_description", label: "Brand description", multiline: true }, { key: "footer_nav_heading", label: "Links heading" },
    { key: "footer_shop_label", label: "Shop link" }, { key: "footer_saved_label", label: "Saved link" }, { key: "footer_track_label", label: "Track link" }, { key: "footer_story_label", label: "Story link" },
    { key: "footer_contact_eyebrow", label: "Contact small heading" }, { key: "footer_contact_title", label: "Contact title" }, { key: "footer_contact_body", label: "Contact description", multiline: true },
    { key: "footer_whatsapp_label", label: "WhatsApp button" }, { key: "whatsapp_number", label: "WhatsApp number", hint: "International format, numbers only" }, { key: "footer_copyright", label: "Copyright text" }, { key: "footer_tagline", label: "Bottom tagline" },
  ] },
  { title: "Search and sharing", description: "How the storefront appears in browser tabs and search results.", fields: [
    { key: "seo_title", label: "Page title" }, { key: "seo_description", label: "Page description", multiline: true },
  ] },
];

async function toWebP(file: File, maxWidth: number) {
  const bitmap = await createImageBitmap(file);
  const width = Math.min(maxWidth, bitmap.width);
  const scale = width / bitmap.width;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to process this image.");
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", .88));
  if (!blob) throw new Error("Image conversion failed.");
  return new File([blob], "storefront.webp", { type: "image/webp" });
}

export function StorefrontSettingsEditor({ initialSettings }: { initialSettings: StorefrontSettings }) {
  const [settings, setSettings] = useState(initialSettings);
  const [logo, setLogo] = useState<File | null>(null);
  const [storyImage, setStoryImage] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState(initialSettings.site_logo_url);
  const [storyPreview, setStoryPreview] = useState(initialSettings.story_image_url);
  const [saving, setSaving] = useState(false);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  function notify(message: string, tone: ToastMessage["tone"] = "info") {
    setToasts((items) => [...items, { id: Date.now() + Math.random(), message, tone }]);
  }
  function update(key: SettingKey, value: string) { setSettings((current) => ({ ...current, [key]: value })); }
  async function selectImage(event: ChangeEvent<HTMLInputElement>, slot: "logo" | "story") {
    const selected = event.target.files?.[0];
    if (!selected) return;
    try {
      const optimized = await toWebP(selected, slot === "logo" ? 900 : 2000);
      const preview = URL.createObjectURL(optimized);
      if (slot === "logo") { setLogo(optimized); setLogoPreview(preview); }
      else { setStoryImage(optimized); setStoryPreview(preview); }
    } catch (error) { notify(error instanceof Error ? error.message : "Unable to prepare the image.", "error"); }
  }
  function clearStoryImage() {
    setStoryImage(null); setStoryPreview(""); update("story_image_url", ""); update("story_image_path", "");
  }
  function restoreDefaultLogo() {
    setLogo(null); setLogoPreview("/codart-logo.png"); update("site_logo_url", "/codart-logo.png"); update("site_logo_path", "");
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true);
    try {
      const form = new FormData(); form.set("settings", JSON.stringify(settings));
      if (logo) form.set("logo", logo); if (storyImage) form.set("story_image", storyImage);
      const response = await fetch("/api/storefront-settings", { method: "PUT", body: form });
      const responseText = await response.text();
      let result: StorefrontSettings & { error?: string };
      try { result = JSON.parse(responseText) as StorefrontSettings & { error?: string }; }
      catch { throw new Error(responseText.trim() || `Storefront update failed with status ${response.status}.`); }
      if (!response.ok) throw new Error(result.error ?? "Unable to save storefront settings.");
      setSettings(result); setLogo(null); setStoryImage(null); setLogoPreview(result.site_logo_url); setStoryPreview(result.story_image_url);
      notify("Storefront changes published.", "success");
    } catch (error) { notify(error instanceof Error ? error.message : "Unable to publish changes.", "error"); }
    finally { setSaving(false); }
  }

  return <form className="storefront-editor" onSubmit={save}>
    <section className="storefront-editor-images">
      <div><p className="eyebrow">Visual identity</p><h2>Storefront images</h2><p>Update the main logo and optionally add artwork behind the story section.</p></div>
      <div className="storefront-image-grid">
        <label className="storefront-image-field"><span>Header and footer logo</span><div className="storefront-image-preview logo-preview" style={{ backgroundImage: `url("${logoPreview}")` }} /> <input type="file" accept="image/*" onChange={(event) => void selectImage(event, "logo")} /><strong><ImageIcon /> Choose logo</strong><small>Transparent PNG recommended. It will be optimized to WebP.</small><button type="button" onClick={restoreDefaultLogo}>Use default logo</button></label>
        <label className="storefront-image-field"><span>Story background</span><div className={`storefront-image-preview ${storyPreview ? "" : "is-empty"}`} style={storyPreview ? { backgroundImage: `url("${storyPreview}")` } : undefined}>{!storyPreview && <em>Gradient only</em>}</div><input type="file" accept="image/*" onChange={(event) => void selectImage(event, "story")} /><strong><ImageIcon /> Choose background</strong><small>A wide image around 2000 × 900 works best.</small>{storyPreview && <button type="button" onClick={clearStoryImage}>Remove background</button>}</label>
      </div>
    </section>
    {groups.map((group) => <section className="storefront-editor-group" key={group.title}><header><h2>{group.title}</h2><p>{group.description}</p></header><div className="storefront-editor-fields">{group.fields.map((field) => <label className={field.multiline ? "is-wide" : ""} key={field.key}><span>{field.label}</span>{field.multiline ? <textarea rows={3} value={settings[field.key]} onChange={(event) => update(field.key, event.target.value)} /> : <input value={settings[field.key]} onChange={(event) => update(field.key, event.target.value)} />}{field.hint && <small>{field.hint}</small>}</label>)}</div></section>)}
    <div className="storefront-editor-publish"><div><strong>Ready to publish?</strong><span>Changes appear across the storefront after saving.</span></div><a href="/" target="_blank">Preview store ↗</a><button type="submit" disabled={saving}>{saving ? "Publishing…" : "Publish changes"}</button></div>
    <ToastStack toasts={toasts} dismiss={(id) => setToasts((items) => items.filter((item) => item.id !== id))} />
  </form>;
}
