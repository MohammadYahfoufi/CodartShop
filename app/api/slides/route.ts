import {
  createLocalSlide,
  getHeroSlides,
  uploadSlideToSupabase,
} from "@/lib/slides";
import {
  getSupabaseAdmin,
  isSupabaseConfigured,
  isSupabaseTemporarilyUnavailable,
  markSupabaseUnavailable,
} from "@/lib/supabase-server";
import { requireAdminAccess } from "@/lib/supabase-auth-server";

export async function GET() {
  return Response.json(await getHeroSlides());
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminAccess();
  if (unauthorized) return unauthorized;
  try {
    const formData = await request.formData();
    const title = String(formData.get("title") ?? "").trim();
    const subtitle = String(formData.get("subtitle") ?? "").trim();
    const ctaLabel = String(formData.get("cta_label") ?? "Shop now").trim();
    const ctaHref = String(formData.get("cta_href") ?? "/#products").trim();
    const sortOrder = Number(formData.get("sort_order") ?? 0);
    const image = formData.get("image");
    if (!title || title.length > 100 || subtitle.length > 240 || !ctaLabel || !ctaHref || !(image instanceof File) || image.size === 0) {
      return Response.json({ error: "Title, image, button label, and button link are required." }, { status: 400 });
    }
    if (image.type !== "image/webp" || image.size > 5 * 1024 * 1024) {
      return Response.json({ error: "Banner images must be WebP and smaller than 5 MB." }, { status: 415 });
    }
    const input = { title, subtitle, cta_label: ctaLabel, cta_href: ctaHref, sort_order: Number.isFinite(sortOrder) ? sortOrder : 0, active: true };
    if (!isSupabaseConfigured || isSupabaseTemporarilyUnavailable()) {
      return Response.json(await createLocalSlide({ ...input, image }), { status: 201 });
    }
    try {
      const storedImage = await uploadSlideToSupabase(image);
      const { data, error } = await getSupabaseAdmin().from("hero_slides").insert({ ...input, ...storedImage }).select("*").single();
      if (error) throw error;
      return Response.json(data, { status: 201 });
    } catch (error) {
      markSupabaseUnavailable();
      console.warn("Supabase banner upload failed; saving locally:", error);
      return Response.json(await createLocalSlide({ ...input, image }), { status: 201 });
    }
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to create banner." }, { status: 500 });
  }
}
