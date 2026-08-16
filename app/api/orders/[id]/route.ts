import { getSupabaseAdmin } from "@/lib/supabase-server";
import type { OrderStatus } from "@/lib/types";

const statuses: OrderStatus[] = ["pending", "confirmed", "fulfilled", "cancelled"];

export async function PATCH(request: Request, context: RouteContext<"/api/orders/[id]">) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    if (!statuses.includes(body?.status)) {
      return Response.json({ error: "Invalid order status." }, { status: 400 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from("orders")
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select("id,status")
      .maybeSingle();
    if (error) throw error;
    if (!data) return Response.json({ error: "Order not found." }, { status: 404 });
    return Response.json(data);
  } catch (error) {
    console.warn("Unable to update order:", error instanceof Error ? error.message : error);
    return Response.json({ error: "Unable to update order." }, { status: 500 });
  }
}
