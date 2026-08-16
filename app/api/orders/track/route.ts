import { getSupabaseAdmin } from "@/lib/supabase-server";
import { getAuthClaims } from "@/lib/supabase-auth-server";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const normalizePhone = (value: unknown) => String(value ?? "").replace(/\D/g, "");

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const orderId = String(body?.orderId ?? "").trim();
    const phone = normalizePhone(body?.phone);
    if (!uuidPattern.test(orderId)) return Response.json({ error: "Enter the complete order number." }, { status: 400 });
    const claims = await getAuthClaims();
    const signedInUserId = typeof claims?.sub === "string" ? claims.sub : "";
    const { data, error } = await getSupabaseAdmin().from("orders").select("id,user_id,customer_phone,status,created_at,updated_at,total,delivery_area,order_items(id,product_title,quantity)").eq("id", orderId).maybeSingle();
    if (error) throw error;
    const ownsOrder = Boolean(data?.user_id && signedInUserId && data.user_id === signedInUserId);
    if (!data || (!ownsOrder && (phone.length < 6 || normalizePhone(data.customer_phone) !== phone))) return Response.json({ error: "Order not found. Sign in with the ordering account or check the phone number." }, { status: 404 });
    const safeOrder = { id: data.id, status: data.status, created_at: data.created_at, updated_at: data.updated_at, total: data.total, delivery_area: data.delivery_area, order_items: data.order_items };
    return Response.json({ order: safeOrder }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.warn("Unable to track order:", error instanceof Error ? error.message : error);
    return Response.json({ error: "Unable to load this order right now." }, { status: 500 });
  }
}
