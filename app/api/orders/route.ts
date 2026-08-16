import { localCatalog } from "@/lib/catalog";
import { getAuthClaims } from "@/lib/supabase-auth-server";
import { getSupabaseAdmin } from "@/lib/supabase-server";
import type { OrderRequest } from "@/lib/types";

type ProductSnapshot = {
  id: string;
  title: string;
  price: number;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET() {
  const claims = await getAuthClaims();
  const userId = typeof claims?.sub === "string" && uuidPattern.test(claims.sub)
    ? claims.sub
    : null;
  if (!userId) return Response.json({ error: "Sign in is required." }, { status: 401 });
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("orders")
      .select("id,total,status,created_at,order_items(id,product_title,unit_price,quantity)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw error;
    return Response.json({ orders: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.warn("Unable to load account orders:", error instanceof Error ? error.message : error);
    return Response.json({ error: "Unable to load your orders." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  let body: OrderRequest;

  try {
    body = (await request.json()) as OrderRequest;
  } catch {
    return Response.json({ error: "Invalid order data." }, { status: 400 });
  }

  const name = String(body?.customer?.name ?? "").trim();
  const phone = String(body?.customer?.phone ?? "").trim();
  const note = String(body?.customer?.note ?? "").trim();
  const rawItems = Array.isArray(body?.items) ? body.items : [];

  if (!name || name.length > 120 || phone.length < 3 || phone.length > 40 || note.length > 1000) {
    return Response.json({ error: "Enter a valid name and phone number." }, { status: 400 });
  }
  if (!rawItems.length || rawItems.length > 50) {
    return Response.json({ error: "Your cart must contain between 1 and 50 products." }, { status: 400 });
  }

  const quantities = new Map<string, number>();
  for (const item of rawItems) {
    const productId = String(item?.productId ?? "").trim();
    const quantity = Number(item?.quantity);
    if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      return Response.json({ error: "Your cart contains an invalid item." }, { status: 400 });
    }
    quantities.set(productId, (quantities.get(productId) ?? 0) + quantity);
  }

  if ([...quantities.values()].some((quantity) => quantity > 99)) {
    return Response.json({ error: "A product quantity cannot exceed 99." }, { status: 400 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const claims = await getAuthClaims();
    const userId = typeof claims?.sub === "string" && uuidPattern.test(claims.sub)
      ? claims.sub
      : null;
    const productIds = [...quantities.keys()];
    const databaseIds = productIds.filter((id) => uuidPattern.test(id));
    const localIds = new Set(productIds.filter((id) => !uuidPattern.test(id)));
    const localProducts: ProductSnapshot[] = localCatalog
      .filter((product) => localIds.has(product.id))
      .map(({ id, title, price }) => ({ id, title, price }));
    const { data, error: productsError } = databaseIds.length
      ? await supabase.from("products").select("id,title,price").in("id", databaseIds)
      : { data: [], error: null };

    if (productsError) throw productsError;
    const products = [...((data ?? []) as ProductSnapshot[]), ...localProducts];
    if (products.length !== productIds.length) {
      return Response.json({ error: "One or more products are no longer available." }, { status: 409 });
    }

    const items = products.map((product) => ({
      product_id: uuidPattern.test(product.id) ? product.id : null,
      product_title: product.title,
      unit_price: Number(product.price),
      quantity: quantities.get(product.id)!,
    }));
    const total = Number(
      items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0).toFixed(2),
    );

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        customer_name: name,
        customer_phone: phone,
        customer_note: note,
        total,
      })
      .select("id,total")
      .single();

    if (orderError) throw orderError;

    const { error: itemsError } = await supabase.from("order_items").insert(
      items.map((item) => ({ ...item, order_id: order.id })),
    );

    if (itemsError) {
      await supabase.from("orders").delete().eq("id", order.id);
      throw itemsError;
    }

    return Response.json({ id: order.id, total: Number(order.total) }, { status: 201 });
  } catch (error) {
    console.warn("Unable to create order:", error instanceof Error ? error.message : error);
    return Response.json({ error: "Unable to save your order. Please try again." }, { status: 500 });
  }
}
