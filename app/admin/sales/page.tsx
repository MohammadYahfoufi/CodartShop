import type { Metadata } from "next";
import { SalesDashboard } from "@/components/sales-dashboard";
import { getAdminOverview } from "@/lib/orders";

export const metadata: Metadata = { title: "Sales" };
export const dynamic = "force-dynamic";

export default async function SalesAdminPage() {
  return <SalesDashboard orders={(await getAdminOverview()).orders} />;
}
