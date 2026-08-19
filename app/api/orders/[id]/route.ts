import { getSupabaseAdmin } from "@/lib/supabase-server";
import type { OrderStatus } from "@/lib/types";
import { requireAdminAccess } from "@/lib/supabase-auth-server";
import { broadcastStoreEvent, realtimeTopics } from "@/lib/realtime-server";

const statuses: OrderStatus[] = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

export async function PATCH(request: Request, context: RouteContext<"/api/orders/[id]">) {
  const unauthorized = await requireAdminAccess();
  if (unauthorized) return unauthorized;
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
      .select("id,status,user_id")
      .maybeSingle();
    if (error) throw error;
    if (!data) return Response.json({ error: "Order not found." }, { status: 404 });
    await Promise.all([
      broadcastStoreEvent(realtimeTopics.adminOrders, "orders-changed"),
      broadcastStoreEvent(realtimeTopics.orderStatus(id), "status-changed"),
      ...(data.user_id ? [broadcastStoreEvent(realtimeTopics.userOrders(data.user_id), "orders-changed")] : []),
    ]);
    return Response.json(data);
  } catch (error) {
    console.warn("Unable to update order:", error instanceof Error ? error.message : error);
    return Response.json({ error: "Unable to update order." }, { status: 500 });
  }
}
