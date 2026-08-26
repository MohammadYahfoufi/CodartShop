import { setLocalProductFeatured } from "@/lib/local-products";
import { requireAdminAccess } from "@/lib/supabase-auth-server";
import {
  getSupabaseAdmin,
  isLocalPersistenceEnabled,
  isSupabaseConfigured,
  isSupabaseTemporarilyUnavailable,
} from "@/lib/supabase-server";
import { broadcastStoreEvent, realtimeTopics } from "@/lib/realtime-server";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdminAccess();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await context.params;
    const body = await request.json() as { featured?: unknown };
    if (typeof body.featured !== "boolean") {
      return Response.json({ error: "A valid trending status is required." }, { status: 400 });
    }

    if (id.startsWith("local-")) {
      if (!isLocalPersistenceEnabled) return Response.json({ error: "Development products cannot be edited in production." }, { status: 409 });
      const product = await setLocalProductFeatured(id, body.featured);
      if (!product) return Response.json({ error: "Product not found." }, { status: 404 });
      return Response.json(product);
    }

    if (!isSupabaseConfigured || isSupabaseTemporarilyUnavailable()) {
      return Response.json({ error: "The product database is temporarily unavailable." }, { status: 503 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from("products")
      .update({ featured: body.featured, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;

    await broadcastStoreEvent(realtimeTopics.catalog, "catalog-changed");
    return Response.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update the trending products.";
    return Response.json({ error: message }, { status: 500 });
  }
}
