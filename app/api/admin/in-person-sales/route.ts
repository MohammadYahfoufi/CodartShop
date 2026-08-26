import { requireAdminAccess } from "@/lib/supabase-auth-server";
import { getSupabaseAdmin, isSupabaseConfigured, isSupabaseTemporarilyUnavailable } from "@/lib/supabase-server";
import { broadcastStoreEvent, realtimeTopics } from "@/lib/realtime-server";

type SaleInput = {
  customerName?: unknown;
  customerPhone?: unknown;
  paymentMethod?: unknown;
  note?: unknown;
  items?: Array<{ productId?: unknown; quantity?: unknown }>;
};

type ProductRow = { id: string; title: string; price: number; sale_price: number | null; stock_quantity: number };
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const unauthorized = await requireAdminAccess();
  if (unauthorized) return unauthorized;
  if (!isSupabaseConfigured || isSupabaseTemporarilyUnavailable()) return Response.json({ error: "The product database is unavailable." }, { status: 503 });

  try {
    const body = await request.json() as SaleInput;
    const customerName = String(body.customerName ?? "").trim().slice(0, 120) || "Walk-in customer";
    const customerPhone = String(body.customerPhone ?? "").trim().slice(0, 40) || "In person";
    const paymentMethod = body.paymentMethod === "whish-money" ? "whish-money" : "cash-on-delivery";
    const paymentLabel = paymentMethod === "whish-money" ? "Whish Money" : "Cash";
    const note = String(body.note ?? "").trim().slice(0, 900);
    if (!Array.isArray(body.items) || !body.items.length || body.items.length > 50) return Response.json({ error: "Add at least one product to the sale." }, { status: 400 });

    const quantities = new Map<string, number>();
    for (const item of body.items) {
      const productId = String(item.productId ?? "").trim();
      const quantity = Number(item.quantity);
      if (!uuidPattern.test(productId) || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) return Response.json({ error: "The sale contains an invalid product or quantity." }, { status: 400 });
      quantities.set(productId, (quantities.get(productId) ?? 0) + quantity);
    }

    const supabase = getSupabaseAdmin();
    const productIds = [...quantities.keys()];
    const { data, error: productsError } = await supabase.from("products").select("id,title,price,sale_price,stock_quantity").in("id", productIds);
    if (productsError) throw productsError;
    const products = (data ?? []) as ProductRow[];
    if (products.length !== productIds.length) return Response.json({ error: "One or more products no longer exist." }, { status: 409 });
    const unavailable = products.find((product) => product.stock_quantity < quantities.get(product.id)!);
    if (unavailable) return Response.json({ error: `${unavailable.title} only has ${unavailable.stock_quantity} in stock.` }, { status: 409 });

    const items = products.map((product) => ({ product_id: product.id, product_title: product.title, unit_price: Number(product.sale_price ?? product.price), quantity: quantities.get(product.id)! }));
    const subtotal = Number(items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0).toFixed(2));
    const { data: order, error: orderError } = await supabase.from("orders").insert({
      user_id: null,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: "",
      delivery_address: "In-store purchase",
      delivery_area: "beirut",
      delivery_fee: 0,
      payment_method: paymentMethod,
      customer_note: `[IN-PERSON SALE · ${paymentLabel.toUpperCase()}]${note ? ` ${note}` : ""}`,
      subtotal,
      total: subtotal,
      status: "delivered",
    }).select("id,total").single();
    if (orderError) throw orderError;

    const { error: itemsError } = await supabase.from("order_items").insert(items.map((item) => ({ ...item, order_id: order.id })));
    if (itemsError) { await supabase.from("orders").delete().eq("id", order.id); throw itemsError; }

    const adjusted: ProductRow[] = [];
    for (const product of products) {
      const nextStock = product.stock_quantity - quantities.get(product.id)!;
      const { data: updated, error } = await supabase.from("products").update({ stock_quantity: nextStock, updated_at: new Date().toISOString() }).eq("id", product.id).eq("stock_quantity", product.stock_quantity).select("id").maybeSingle();
      if (error || !updated) {
        for (const previous of adjusted) await supabase.from("products").update({ stock_quantity: previous.stock_quantity }).eq("id", previous.id);
        await supabase.from("orders").delete().eq("id", order.id);
        return Response.json({ error: `${product.title} stock changed while completing the sale. Review the basket and try again.` }, { status: 409 });
      }
      adjusted.push(product);
    }

    await Promise.all([broadcastStoreEvent(realtimeTopics.adminOrders, "orders-changed"), broadcastStoreEvent(realtimeTopics.catalog, "catalog-changed")]);
    return Response.json({ id: order.id, total: Number(order.total) }, { status: 201 });
  } catch (error) {
    console.warn("Unable to record in-person sale:", error instanceof Error ? error.message : error);
    return Response.json({ error: "Unable to record this sale. Please try again." }, { status: 500 });
  }
}
