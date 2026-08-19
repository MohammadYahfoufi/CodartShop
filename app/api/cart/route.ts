import { localCatalog } from "@/lib/catalog";
import { getAuthClaims } from "@/lib/supabase-auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import { isLocalPersistenceEnabled } from "@/lib/supabase-server";
import type { CartItem, Product } from "@/lib/types";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type CartInput = { productId: string; quantity: number };
type StoredCartItem = { product_id: string; quantity: number };

async function authenticatedUserId() {
  const claims = await getAuthClaims();
  return typeof claims?.sub === "string" && uuidPattern.test(claims.sub)
    ? claims.sub
    : null;
}

function normalizeItems(value: unknown): CartInput[] | null {
  if (!Array.isArray(value) || value.length > 50) return null;
  const quantities = new Map<string, number>();
  for (const item of value) {
    const productId = String(item?.productId ?? "").trim();
    const quantity = Number(item?.quantity);
    if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return null;
    }
    quantities.set(productId, Math.min(99, (quantities.get(productId) ?? 0) + quantity));
  }
  return [...quantities].map(([productId, quantity]) => ({ productId, quantity }));
}

async function productsById(productIds: string[]) {
  const databaseIds = productIds.filter((id) => uuidPattern.test(id));
  const localById = new Map((isLocalPersistenceEnabled ? localCatalog : []).map((product) => [product.id, product]));
  const { data, error } = databaseIds.length
    ? await getSupabaseAdmin().from("products").select("*").in("id", databaseIds)
    : { data: [], error: null };
  if (error) throw error;
  const products = new Map<string, Product>();
  for (const product of data ?? []) products.set(product.id, product as Product);
  for (const id of productIds) {
    const product = localById.get(id);
    if (product) products.set(id, product);
  }
  return products;
}

async function loadCart(userId: string): Promise<CartItem[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from("cart_items")
    .select("product_id,quantity")
    .eq("user_id", userId)
    .order("created_at");
  if (error) throw error;
  const rows = (data ?? []) as StoredCartItem[];
  const products = await productsById(rows.map((row) => row.product_id));
  const staleIds = rows.filter((row) => !products.has(row.product_id)).map((row) => row.product_id);
  if (staleIds.length) {
    await supabase.from("cart_items").delete().eq("user_id", userId).in("product_id", staleIds);
  }
  return rows.flatMap((row) => {
    const product = products.get(row.product_id);
    return product ? [{ ...product, quantity: row.quantity }] : [];
  });
}

export async function GET() {
  const userId = await authenticatedUserId();
  if (!userId) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    return Response.json({ items: await loadCart(userId) });
  } catch (error) {
    console.warn("Unable to load cart:", error instanceof Error ? error.message : error);
    return Response.json({ error: "Unable to load your cart." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const userId = await authenticatedUserId();
  if (!userId) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const incoming = normalizeItems((await request.json())?.items);
    if (!incoming) return Response.json({ error: "Invalid cart data." }, { status: 400 });
    const products = await productsById(incoming.map((item) => item.productId));
    if (products.size !== incoming.length) {
      return Response.json({ error: "One or more products are unavailable." }, { status: 409 });
    }
    const supabase = getSupabaseAdmin();
    const { data: current, error: currentError } = await supabase
      .from("cart_items")
      .select("product_id,quantity")
      .eq("user_id", userId);
    if (currentError) throw currentError;
    const currentQuantities = new Map(
      ((current ?? []) as StoredCartItem[]).map((item) => [item.product_id, item.quantity]),
    );
    if (incoming.length) {
      const { error } = await supabase.from("cart_items").upsert(
        incoming.map((item) => ({
          user_id: userId,
          product_id: item.productId,
          quantity: Math.max(item.quantity, currentQuantities.get(item.productId) ?? 0),
          updated_at: new Date().toISOString(),
        })),
      );
      if (error) throw error;
    }
    return Response.json({ items: await loadCart(userId) });
  } catch (error) {
    console.warn("Unable to merge cart:", error instanceof Error ? error.message : error);
    return Response.json({ error: "Unable to sync your cart." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const userId = await authenticatedUserId();
  if (!userId) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const items = normalizeItems((await request.json())?.items);
    if (!items) return Response.json({ error: "Invalid cart data." }, { status: 400 });
    const products = await productsById(items.map((item) => item.productId));
    if (products.size !== items.length) {
      return Response.json({ error: "One or more products are unavailable." }, { status: 409 });
    }
    const supabase = getSupabaseAdmin();
    const { data: current, error: currentError } = await supabase
      .from("cart_items")
      .select("product_id")
      .eq("user_id", userId);
    if (currentError) throw currentError;
    if (items.length) {
      const { error } = await supabase.from("cart_items").upsert(
        items.map((item) => ({
          user_id: userId,
          product_id: item.productId,
          quantity: item.quantity,
          updated_at: new Date().toISOString(),
        })),
      );
      if (error) throw error;
    }
    const requestedIds = new Set(items.map((item) => item.productId));
    const staleIds = (current ?? [])
      .map((item) => item.product_id as string)
      .filter((id) => !requestedIds.has(id));
    if (staleIds.length) {
      const { error } = await supabase
        .from("cart_items")
        .delete()
        .eq("user_id", userId)
        .in("product_id", staleIds);
      if (error) throw error;
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    console.warn("Unable to save cart:", error instanceof Error ? error.message : error);
    return Response.json({ error: "Unable to save your cart." }, { status: 500 });
  }
}
