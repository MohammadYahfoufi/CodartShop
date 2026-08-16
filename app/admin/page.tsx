import type { Metadata } from "next";
import { AdminOverview } from "@/components/admin-overview";
import { getProducts } from "@/lib/products";
import { getAdminOverview } from "@/lib/orders";

export const metadata: Metadata = { title: "Admin dashboard" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [products, overview] = await Promise.all([
    getProducts(),
    getAdminOverview(),
  ]);
  return <AdminOverview productCount={products.length} favoriteCount={overview.favoriteCount} orders={overview.orders} />;
}
