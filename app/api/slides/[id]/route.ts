import { deleteLocalSlide, updateLocalSlide } from "@/lib/slides";
import { getSupabaseAdmin, isLocalPersistenceEnabled, PRODUCT_IMAGES_BUCKET } from "@/lib/supabase-server";
import { requireAdminAccess } from "@/lib/supabase-auth-server";

export async function PATCH(request: Request, context: RouteContext<"/api/slides/[id]">) {
  const unauthorized = await requireAdminAccess();
  if (unauthorized) return unauthorized;
  try {
    const { id } = await context.params;
    const body = await request.json();
    const updates: { active?: boolean; sort_order?: number } = {};
    if (typeof body?.active === "boolean") updates.active = body.active;
    if (Number.isInteger(body?.sort_order)) updates.sort_order = body.sort_order;
    if (!Object.keys(updates).length) return Response.json({ error: "No valid changes supplied." }, { status: 400 });
    if (id.startsWith("local-")) {
      if (!isLocalPersistenceEnabled) {
        return Response.json({ error: "This development-only banner is not stored in production. Publish a new banner to migrate it to Supabase Storage." }, { status: 409 });
      }
      const slide = await updateLocalSlide(id, updates);
      return slide ? Response.json(slide) : Response.json({ error: "Banner not found." }, { status: 404 });
    }
    const { data, error } = await getSupabaseAdmin().from("hero_slides").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", id).select("*").maybeSingle();
    if (error) throw error;
    return data ? Response.json(data) : Response.json({ error: "Banner not found." }, { status: 404 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to update banner." }, { status: 500 });
  }
}

export async function POST(_request: Request, context: RouteContext<"/api/slides/[id]">) {
  const unauthorized = await requireAdminAccess();
  if (unauthorized) return unauthorized;
  try {
    const { id } = await context.params;
    if (id.startsWith("local-")) return Response.json({ error: "Connect Supabase to duplicate this banner." }, { status: 409 });
    const supabase = getSupabaseAdmin();
    const { data: existing, error: readError } = await supabase.from("hero_slides").select("*").eq("id", id).maybeSingle();
    if (readError) throw readError;
    if (!existing) return Response.json({ error: "Banner not found." }, { status: 404 });
    const imagePath = `slides/${crypto.randomUUID()}.webp`;
    const { error: copyError } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).copy(existing.image_path, imagePath);
    if (copyError) throw copyError;
    const imageUrl = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(imagePath).data.publicUrl;
    const fields = Object.fromEntries(Object.entries(existing).filter(([key]) => !["id", "created_at", "updated_at"].includes(key)));
    const { data, error } = await supabase.from("hero_slides").insert({ ...fields, title: `${existing.title} Copy`.slice(0, 100), image_path: imagePath, image_url: imageUrl, sort_order: Number(existing.sort_order) + 1, active: false }).select("*").single();
    if (error) { await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([imagePath]); throw error; }
    return Response.json(data, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to duplicate banner." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/slides/[id]">) {
  const unauthorized = await requireAdminAccess();
  if (unauthorized) return unauthorized;
  try {
    const { id } = await context.params;
    if (id.startsWith("local-")) {
      if (!isLocalPersistenceEnabled) return new Response(null, { status: 204 });
      return await deleteLocalSlide(id) ? new Response(null, { status: 204 }) : Response.json({ error: "Banner not found." }, { status: 404 });
    }
    const supabase = getSupabaseAdmin();
    const { data, error: readError } = await supabase.from("hero_slides").select("image_path").eq("id", id).maybeSingle();
    if (readError) throw readError;
    if (!data) return Response.json({ error: "Banner not found." }, { status: 404 });
    const { error: storageError } = await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .remove([data.image_path]);
    if (storageError) throw new Error(`Unable to delete the banner image: ${storageError.message}`);
    const { error: deleteError } = await supabase.from("hero_slides").delete().eq("id", id);
    if (deleteError) throw new Error(`Unable to delete the banner record: ${deleteError.message}`);
    return new Response(null, { status: 204 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to delete banner." }, { status: 500 });
  }
}
