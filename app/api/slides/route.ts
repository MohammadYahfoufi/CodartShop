import {
  createLocalSlide,
  getHeroSlides,
  uploadSlideToSupabase,
} from "@/lib/slides";
import {
  getSupabaseAdmin,
  isLocalPersistenceEnabled,
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
    if (isLocalPersistenceEnabled && (!isSupabaseConfigured || isSupabaseTemporarilyUnavailable())) {
      return Response.json(await createLocalSlide({ ...input, image }), { status: 201 });
    }
    if (!isSupabaseConfigured) {
      return Response.json({ error: "Supabase Storage is not configured for production uploads." }, { status: 503 });
    }
    try {
      const storedImage = await uploadSlideToSupabase(image);
      const { data, error } = await getSupabaseAdmin().from("hero_slides").insert({ ...input, ...storedImage }).select("*").single();
      if (error) {
        await getSupabaseAdmin().storage.from("CodartlbShop").remove([storedImage.image_path]);
        throw new Error(`Banner metadata could not be saved: ${error.message}`);
      }
      return Response.json(data, { status: 201 });
    } catch (error) {
      markSupabaseUnavailable();
      console.warn("Supabase banner upload failed:", error);
      if (isLocalPersistenceEnabled) {
        return Response.json(await createLocalSlide({ ...input, image }), { status: 201 });
      }
      return Response.json(
        { error: error instanceof Error ? error.message : "Unable to publish the banner through Supabase." },
        { status: 502 },
      );
    }
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to create banner." }, { status: 500 });
  }
}
