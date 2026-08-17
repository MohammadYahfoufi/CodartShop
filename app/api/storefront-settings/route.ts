import { requireAdminAccess } from "@/lib/supabase-auth-server";
import {
  getStorefrontSettings,
  normalizeStorefrontSettings,
  removeStorefrontImage,
  saveStorefrontSettings,
  uploadStorefrontImage,
} from "@/lib/storefront-settings";

const limits: Record<string, number> = {
  site_name: 60,
  seo_title: 70,
  seo_description: 180,
  story_title: 140,
  story_body: 500,
  footer_description: 400,
  footer_contact_title: 100,
  footer_contact_body: 400,
};

function validateSettings(value: unknown) {
  const settings = normalizeStorefrontSettings(value);
  for (const [key, max] of Object.entries(limits)) {
    if (settings[key as keyof typeof settings].length > max) throw new Error(`${key.replaceAll("_", " ")} must be ${max} characters or fewer.`);
  }
  if (!settings.site_name.trim() || !settings.seo_title.trim()) throw new Error("Store name and SEO title are required.");
  if (!settings.fallback_hero_cta_href.startsWith("/") && !settings.fallback_hero_cta_href.startsWith("https://")) {
    throw new Error("The hero button link must begin with / or https://.");
  }
  return settings;
}

function validImage(value: FormDataEntryValue | null): value is File {
  return value instanceof File && value.size > 0;
}

function errorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return "Unable to save storefront settings.";
}

export async function GET() {
  return Response.json(await getStorefrontSettings());
}

export async function PUT(request: Request) {
  const unauthorized = await requireAdminAccess();
  if (unauthorized) return unauthorized;
  const uploadedPaths: string[] = [];
  try {
    const current = await getStorefrontSettings();
    const form = await request.formData();
    const raw = JSON.parse(String(form.get("settings") ?? "{}"));
    const next = validateSettings(raw);
    const logo = form.get("logo");
    const story = form.get("story_image");
    for (const file of [logo, story]) {
      if (validImage(file) && (file.type !== "image/webp" || file.size > 5 * 1024 * 1024)) {
        return Response.json({ error: "Storefront images must be WebP and smaller than 5 MB." }, { status: 415 });
      }
    }
    if (validImage(logo)) {
      const uploaded = await uploadStorefrontImage(logo, "logo");
      uploadedPaths.push(uploaded.path);
      next.site_logo_url = uploaded.url;
      next.site_logo_path = uploaded.path;
    }
    if (validImage(story)) {
      const uploaded = await uploadStorefrontImage(story, "story");
      uploadedPaths.push(uploaded.path);
      next.story_image_url = uploaded.url;
      next.story_image_path = uploaded.path;
    }
    await saveStorefrontSettings(next);
    if (next.site_logo_path !== current.site_logo_path) await removeStorefrontImage(current.site_logo_path);
    if (next.story_image_path !== current.story_image_path) await removeStorefrontImage(current.story_image_path);
    return Response.json(next);
  } catch (error) {
    await Promise.all(uploadedPaths.map((imagePath) => removeStorefrontImage(imagePath)));
    console.error("Storefront settings update failed:", error);
    return Response.json({ error: errorMessage(error) }, { status: 500 });
  }
}
