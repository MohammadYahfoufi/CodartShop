import type { Metadata } from "next";
import { TrendingManager } from "@/components/trending-manager";
import { getProducts } from "@/lib/products";

export const metadata: Metadata = { title: "Trending products" };
export const dynamic = "force-dynamic";

export default async function TrendingAdminPage() {
  return <TrendingManager initialProducts={await getProducts()} />;
}
