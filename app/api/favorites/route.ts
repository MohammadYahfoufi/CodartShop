import { localCatalog } from "@/lib/catalog";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getAuthClaims } from "@/lib/supabase-auth-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validVisitorId(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

async function resolvedVisitorId(value: unknown) {
  const claims = await getAuthClaims();
  if (typeof claims?.sub === "string" && validVisitorId(claims.sub)) return claims.sub;
  return validVisitorId(value) ? value : null;
}

async function allowedProductIds(ids: string[]) {
  const uniqueIds = [...new Set(ids)].slice(0, 100);
  const localIds = new Set(localCatalog.map((product) => product.id));
  const databaseIds = uniqueIds.filter((id) => uuidPattern.test(id));
  const allowed = new Set(uniqueIds.filter((id) => localIds.has(id)));

  if (databaseIds.length) {
    const { data, error } = await getSupabaseAdmin()
      .from("products")
      .select("id")
      .in("id", databaseIds);
    if (error) throw error;
    for (const product of data ?? []) allowed.add(product.id);
  }

  return [...allowed];
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const visitorId = await resolvedVisitorId(body?.visitorId);
    if (!visitorId || !Array.isArray(body?.productIds) || body.productIds.length > 100) {
      return Response.json({ error: "Invalid favorites data." }, { status: 400 });
    }

    const requested = body.productIds.filter((id: unknown): id is string => typeof id === "string");
    const supabase = getSupabaseAdmin();
    const [allowed, existingResult] = await Promise.all([
      allowedProductIds(requested),
      supabase.from("favorites").select("product_id").eq("visitor_id", visitorId),
    ]);
    if (existingResult.error) throw existingResult.error;

    const merged = [...new Set([
      ...(existingResult.data ?? []).map((favorite) => favorite.product_id),
      ...allowed,
    ])];
    const missing = allowed.filter(
      (id) => !(existingResult.data ?? []).some((favorite) => favorite.product_id === id),
    );
    if (missing.length) {
      const { error } = await supabase.from("favorites").insert(
        missing.map((productId) => ({ visitor_id: visitorId, product_id: productId })),
      );
      if (error) throw error;
    }

    return Response.json({ productIds: merged });
  } catch (error) {
    console.warn("Unable to sync favorites:", error instanceof Error ? error.message : error);
    return Response.json({ error: "Unable to sync favorites." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const visitorId = await resolvedVisitorId(body?.visitorId);
    if (!visitorId || typeof body?.productId !== "string") {
      return Response.json({ error: "Invalid favorite." }, { status: 400 });
    }
    const [productId] = await allowedProductIds([body.productId]);
    if (!productId) return Response.json({ error: "Product not found." }, { status: 404 });

    const { error } = await getSupabaseAdmin()
      .from("favorites")
      .upsert({ visitor_id: visitorId, product_id: productId });
    if (error) throw error;
    return new Response(null, { status: 204 });
  } catch (error) {
    console.warn("Unable to save favorite:", error instanceof Error ? error.message : error);
    return Response.json({ error: "Unable to save favorite." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const visitorId = await resolvedVisitorId(body?.visitorId);
    if (!visitorId || typeof body?.productId !== "string") {
      return Response.json({ error: "Invalid favorite." }, { status: 400 });
    }
    const { error } = await getSupabaseAdmin()
      .from("favorites")
      .delete()
      .eq("visitor_id", visitorId)
      .eq("product_id", body.productId);
    if (error) throw error;
    return new Response(null, { status: 204 });
  } catch (error) {
    console.warn("Unable to remove favorite:", error instanceof Error ? error.message : error);
    return Response.json({ error: "Unable to remove favorite." }, { status: 500 });
  }
}
