import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin-dashboard";
import { getProducts } from "@/lib/products";
import { getAdminOverview } from "@/lib/orders";
import { isSupabaseConfigured } from "@/lib/supabase-server";

export const metadata: Metadata = { title: "Product administration" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [products, overview] = await Promise.all([getProducts(), getAdminOverview()]);
  return (
    <AdminDashboard
      initialProducts={products}
      initialOrders={overview.orders}
      favoriteCount={overview.favoriteCount}
      configured={isSupabaseConfigured}
    />
  );
}
