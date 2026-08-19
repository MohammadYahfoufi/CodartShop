import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin-dashboard";
import { getProducts } from "@/lib/products";
import { getStorefrontSettings } from "@/lib/storefront-settings";
import { isSupabaseConfigured } from "@/lib/supabase-server";

export const metadata: Metadata = { title: "Products" };
export const dynamic = "force-dynamic";

export default async function ProductsAdminPage() {
  const [products, settings] = await Promise.all([getProducts(), getStorefrontSettings()]);
  return <AdminDashboard initialProducts={products} initialProductBackgroundColor={settings.product_background_color} initialOrders={[]} favoriteCount={0} initialSlides={[]} configured={isSupabaseConfigured} productsOnly />;
}
