import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  getSupabaseAdmin,
  isLocalPersistenceEnabled,
  isSupabaseConfigured,
  isSupabaseTemporarilyUnavailable,
  markSupabaseAvailable,
  markSupabaseUnavailable,
  PRODUCT_IMAGES_BUCKET,
} from "@/lib/supabase-server";
import type { StorefrontSettings } from "@/lib/types";

const localSettingsFile = path.join(process.cwd(), "data", "storefront-settings.json");

export const defaultStorefrontSettings: StorefrontSettings = {
  site_name: "Codart",
  site_logo_url: "/codart-logo.png",
  site_logo_path: "",
  header_shop_label: "Shop",
  header_story_label: "Our story",
  header_contact_label: "Contact",
  header_track_label: "Track order",
  header_saved_label: "Saved",
  header_cart_label: "Cart",
  hero_eyebrow: "Codart featured",
  fallback_hero_title: "Better tech. Less noise.",
  fallback_hero_subtitle: "Future-ready essentials for your desk, your pocket, and everything in between.",
  fallback_hero_cta_label: "Explore the collection",
  fallback_hero_cta_href: "/#products",
  catalog_eyebrow: "The collection",
  catalog_title: "Tools worth using.",
  catalog_search_placeholder: "Search the collection",
  product_background_color: "#e9ecf7",
  story_eyebrow: "Why Codart",
  story_title: "We believe good technology should feel simple.",
  story_body: "So we skip the endless catalog and choose a focused collection of products that earn their place in your day.",
  story_image_url: "",
  story_image_path: "",
  footer_description: "Useful technology, carefully selected. No endless catalog—just products worth bringing into your day.",
  footer_nav_heading: "Explore",
  footer_shop_label: "Shop products",
  footer_saved_label: "Saved items",
  footer_track_label: "Track order",
  footer_story_label: "Our story",
  footer_contact_eyebrow: "Need a hand?",
  footer_contact_title: "Let’s talk tech.",
  footer_contact_body: "Questions about a product, delivery, or your order? Send us a message directly.",
  footer_whatsapp_label: "Message us on WhatsApp",
  whatsapp_number: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "") ?? "",
  footer_copyright: "Codart. All rights reserved.",
  footer_tagline: "Technology, thoughtfully selected.",
  seo_title: "Codart - Future-ready tech",
  seo_description: "Curated technology for better work, play, and everything in between.",
};

export function normalizeStorefrontSettings(value: unknown): StorefrontSettings {
  if (!value || typeof value !== "object") return { ...defaultStorefrontSettings };
  const source = value as Record<string, unknown>;
  const normalized = Object.fromEntries(Object.entries(defaultStorefrontSettings).map(([key, fallback]) => {
    const candidate = source[key];
    return [key, typeof candidate === "string" ? candidate : fallback];
  })) as StorefrontSettings;
  if (!/^#[0-9a-f]{6}$/i.test(normalized.product_background_color)) {
    normalized.product_background_color = defaultStorefrontSettings.product_background_color;
  }
  return normalized;
}

async function readLocalSettings() {
  try {
    return normalizeStorefrontSettings(JSON.parse(await readFile(localSettingsFile, "utf8")));
  } catch {
    return { ...defaultStorefrontSettings };
  }
}

export async function getStorefrontSettings(): Promise<StorefrontSettings> {
  if (!isSupabaseConfigured || isSupabaseTemporarilyUnavailable()) {
    return isLocalPersistenceEnabled ? readLocalSettings() : { ...defaultStorefrontSettings };
  }
  try {
    const { data, error } = await getSupabaseAdmin().from("storefront_settings").select("settings").eq("id", "main").maybeSingle();
    if (error) throw error;
    markSupabaseAvailable();
    return normalizeStorefrontSettings(data?.settings);
  } catch (error) {
    markSupabaseUnavailable();
    console.warn("Unable to load storefront settings from Supabase:", error);
    return isLocalPersistenceEnabled ? readLocalSettings() : { ...defaultStorefrontSettings };
  }
}

export async function saveStorefrontSettings(settings: StorefrontSettings) {
  if (isLocalPersistenceEnabled && (!isSupabaseConfigured || isSupabaseTemporarilyUnavailable())) {
    await mkdir(path.dirname(localSettingsFile), { recursive: true });
    await writeFile(localSettingsFile, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
    return settings;
  }
  if (!isSupabaseConfigured) throw new Error("Supabase is required to save production storefront settings.");
  const { error } = await getSupabaseAdmin().from("storefront_settings").upsert({ id: "main", settings, updated_at: new Date().toISOString() });
  if (error) {
    if (error.code === "42P01") throw new Error("Storefront settings table is missing. Run supabase/storefront-settings.sql once.");
    throw new Error(`Storefront settings could not be saved: ${error.message}`);
  }
  return settings;
}

export async function uploadStorefrontImage(image: File, slot: "logo" | "story") {
  if (!isSupabaseConfigured) throw new Error("Supabase Storage is required for storefront images.");
  const imagePath = `storefront/${slot}-${crypto.randomUUID()}.webp`;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(imagePath, image, { contentType: "image/webp", cacheControl: "31536000" });
  if (error) throw error;
  return { path: imagePath, url: supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(imagePath).data.publicUrl };
}

export async function removeStorefrontImage(imagePath: string) {
  if (!imagePath.startsWith("storefront/") || !isSupabaseConfigured) return;
  await getSupabaseAdmin().storage.from(PRODUCT_IMAGES_BUCKET).remove([imagePath]);
}
