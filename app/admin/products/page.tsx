import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin-dashboard";
import { getProducts } from "@/lib/products";
import { isSupabaseConfigured } from "@/lib/supabase-server";

export const metadata: Metadata = { title: "Products" };
export const dynamic = "force-dynamic";

export default async function ProductsAdminPage() {
  return <AdminDashboard initialProducts={await getProducts()} initialOrders={[]} favoriteCount={0} initialSlides={[]} configured={isSupabaseConfigured} productsOnly />;
}
