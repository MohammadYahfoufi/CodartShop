import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin-dashboard";
import { getProducts } from "@/lib/products";
import { isSupabaseConfigured } from "@/lib/supabase-server";

export const metadata: Metadata = { title: "Product administration" };

export default async function AdminPage() {
  return <AdminDashboard initialProducts={await getProducts()} configured={isSupabaseConfigured} />;
}
