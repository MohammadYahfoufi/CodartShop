import "server-only";

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
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
import type { HeroSlide } from "@/lib/types";

const slidesFile = path.join(process.cwd(), "data", "slides.json");
const localUploads = path.join(process.cwd(), "public", "uploads");

async function readLocalSlides(): Promise<HeroSlide[]> {
  try {
    const value = JSON.parse(await readFile(slidesFile, "utf8")) as HeroSlide[];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

async function writeLocalSlides(slides: HeroSlide[]) {
  if (!isLocalPersistenceEnabled) throw new Error("Local banner storage is unavailable in production. Use Supabase Storage.");
  await mkdir(path.dirname(slidesFile), { recursive: true });
  await writeFile(slidesFile, `${JSON.stringify(slides, null, 2)}\n`, "utf8");
}

async function saveLocalImage(id: string, image: File) {
  if (!isLocalPersistenceEnabled) throw new Error("Local banner uploads are unavailable in production. Use Supabase Storage.");
  await mkdir(localUploads, { recursive: true });
  const filename = `slide-${id}.webp`;
  await writeFile(path.join(localUploads, filename), Buffer.from(await image.arrayBuffer()));
  return { image_url: `/uploads/${filename}`, image_path: `uploads/${filename}` };
}

export async function getHeroSlides(includeInactive = false): Promise<HeroSlide[]> {
  if (!isSupabaseConfigured || isSupabaseTemporarilyUnavailable()) {
    const slides = await readLocalSlides();
    return slides.filter((slide) => includeInactive || slide.active).sort((a, b) => a.sort_order - b.sort_order);
  }
  try {
    let query = getSupabaseAdmin().from("hero_slides").select("*").order("sort_order");
    if (!includeInactive) query = query.eq("active", true);
    const { data, error } = await query;
    if (error) throw error;
    markSupabaseAvailable();
    return (data ?? []) as HeroSlide[];
  } catch (error) {
    markSupabaseUnavailable();
    console.warn("Unable to load hero slides; using local slides:", error);
    const slides = await readLocalSlides();
    return slides.filter((slide) => includeInactive || slide.active).sort((a, b) => a.sort_order - b.sort_order);
  }
}

export async function createLocalSlide(input: Omit<HeroSlide, "id" | "image_url" | "image_path" | "created_at" | "updated_at"> & { image: File }) {
  const slides = await readLocalSlides();
  const id = `local-${crypto.randomUUID()}`;
  const storedImage = await saveLocalImage(id, input.image);
  const timestamp = new Date().toISOString();
  const slide: HeroSlide = { id, title: input.title, subtitle: input.subtitle, cta_label: input.cta_label, cta_href: input.cta_href, sort_order: input.sort_order, active: input.active, ...storedImage, created_at: timestamp, updated_at: timestamp };
  await writeLocalSlides([...slides, slide]);
  return slide;
}

export async function updateLocalSlide(id: string, updates: Partial<HeroSlide>) {
  const slides = await readLocalSlides();
  const existing = slides.find((slide) => slide.id === id);
  if (!existing) return null;
  const updated = { ...existing, ...updates, id, updated_at: new Date().toISOString() };
  await writeLocalSlides(slides.map((slide) => slide.id === id ? updated : slide));
  return updated;
}

export async function deleteLocalSlide(id: string) {
  const slides = await readLocalSlides();
  const existing = slides.find((slide) => slide.id === id);
  if (!existing) return false;
  await writeLocalSlides(slides.filter((slide) => slide.id !== id));
  if (existing.image_path.startsWith("uploads/")) {
    try { await unlink(path.join(process.cwd(), "public", existing.image_path)); } catch { }
  }
  return true;
}

export async function uploadSlideToSupabase(image: File) {
  const pathName = `banners/${crypto.randomUUID()}.webp`;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(pathName, image, { contentType: "image/webp", cacheControl: "31536000" });
  if (error) throw error;
  return { image_path: pathName, image_url: supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(pathName).data.publicUrl };
}
