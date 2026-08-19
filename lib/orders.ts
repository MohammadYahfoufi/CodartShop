import "server-only";

import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase-server";
import type { AdminOrder } from "@/lib/types";

export async function getAdminOverview(): Promise<{
  orders: AdminOrder[];
  favoriteCount: number;
}> {
  if (!isSupabaseConfigured) return { orders: [], favoriteCount: 0 };

  try {
    const supabase = getSupabaseAdmin();
    const [ordersResult, favoritesResult] = await Promise.all([
      supabase
        .from("orders")
        .select("id,customer_name,customer_phone,customer_email,delivery_address,delivery_area,delivery_fee,payment_method,customer_note,subtotal,total,status,created_at,order_items(id,product_title,unit_price,quantity)")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("favorites").select("product_id", { count: "exact", head: true }),
    ]);
    if (ordersResult.error) throw ordersResult.error;
    if (favoritesResult.error) throw favoritesResult.error;
    return {
      orders: (ordersResult.data ?? []) as AdminOrder[],
      favoriteCount: favoritesResult.count ?? 0,
    };
  } catch (error) {
    console.warn("Unable to load admin overview; using an empty overview:", error instanceof Error ? error.message : error);
    return { orders: [], favoriteCount: 0 };
  }
}
