import { localCatalog } from "@/lib/catalog";
import { getAuthClaims } from "@/lib/supabase-auth-server";
import { getSupabaseAdmin, isLocalPersistenceEnabled } from "@/lib/supabase-server";
import type { OrderRequest } from "@/lib/types";
import { getDeliveryArea, getPaymentMethod } from "@/lib/checkout";
import { sendOrderReceivedEmail } from "@/lib/order-email";
import { broadcastStoreEvent, realtimeTopics } from "@/lib/realtime-server";

type ProductSnapshot = {
  id: string;
  title: string;
  price: number;
  sale_price?: number | null;
  stock_quantity?: number;
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
      .select("id,subtotal,delivery_fee,total,status,created_at,order_items(id,product_title,unit_price,quantity)")
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
  const email = String(body?.customer?.email ?? "").trim().toLowerCase();
  const address = String(body?.customer?.address ?? "").trim();
  const area = getDeliveryArea(body?.customer?.area);
  const payment = getPaymentMethod(body?.customer?.paymentMethod);
  const note = String(body?.customer?.note ?? "").trim();
  const rawItems = Array.isArray(body?.items) ? body.items : [];

  if (!name || name.length > 120 || phone.length < 3 || phone.length > 40 || !/^\S+@\S+\.\S+$/.test(email) || address.length < 5 || address.length > 500 || !area || !payment || note.length > 1000) {
    return Response.json({ error: "Enter valid contact, delivery, and payment details." }, { status: 400 });
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
    const localProducts: ProductSnapshot[] = (isLocalPersistenceEnabled ? localCatalog : [])
      .filter((product) => localIds.has(product.id))
      .map(({ id, title, price }) => ({ id, title, price }));
    const { data, error: productsError } = databaseIds.length
      ? await supabase.from("products").select("id,title,price,sale_price,stock_quantity").in("id", databaseIds)
      : { data: [], error: null };

    if (productsError) throw productsError;
    const products = [...((data ?? []) as ProductSnapshot[]), ...localProducts];
    if (products.length !== productIds.length) {
      return Response.json({ error: "One or more products are no longer available." }, { status: 409 });
    }

    const unavailable = products.find((product) => uuidPattern.test(product.id) && Number(product.stock_quantity ?? 0) < quantities.get(product.id)!);
    if (unavailable) return Response.json({ error: `${unavailable.title} does not have enough stock.` }, { status: 409 });

    const items = products.map((product) => ({
      product_id: uuidPattern.test(product.id) ? product.id : null,
      product_title: product.title,
      unit_price: Number(product.sale_price ?? product.price),
      quantity: quantities.get(product.id)!,
    }));
    const subtotal = Number(
      items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0).toFixed(2),
    );
    const deliveryFee = area.fee;
    const total = Number((subtotal + deliveryFee).toFixed(2));

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: userId,
        customer_name: name,
        customer_phone: phone,
        customer_email: email,
        delivery_address: address,
        delivery_area: area.value,
        delivery_fee: deliveryFee,
        payment_method: payment.value,
        customer_note: note,
        subtotal,
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

    for (const product of products) {
      if (!uuidPattern.test(product.id)) continue;
      const nextStock = Math.max(0, Number(product.stock_quantity ?? 0) - quantities.get(product.id)!);
      const { error: stockError } = await supabase.from("products").update({ stock_quantity: nextStock, updated_at: new Date().toISOString() }).eq("id", product.id);
      if (stockError) console.warn("Unable to decrement inventory:", stockError.message);
    }

    const receipt = { id: order.id, subtotal, deliveryFee, total: Number(order.total) };
    try { await sendOrderReceivedEmail(body.customer, receipt); }
    catch (emailError) { console.warn("Unable to send order receipt:", emailError instanceof Error ? emailError.message : emailError); }
    await Promise.all([
      broadcastStoreEvent(realtimeTopics.adminOrders, "orders-changed"),
      broadcastStoreEvent(realtimeTopics.catalog, "catalog-changed"),
      ...(userId ? [broadcastStoreEvent(realtimeTopics.userOrders(userId), "orders-changed")] : []),
    ]);
    return Response.json(receipt, { status: 201 });
  } catch (error) {
    console.warn("Unable to create order:", error instanceof Error ? error.message : error);
    return Response.json({ error: "Unable to save your order. Please try again." }, { status: 500 });
  }
}
