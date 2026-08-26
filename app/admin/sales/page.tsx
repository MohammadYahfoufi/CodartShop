import type { Metadata } from "next";
import { SalesDashboard } from "@/components/sales-dashboard";
import { getSalesOrders } from "@/lib/orders";

export const metadata: Metadata = { title: "Sales" };
export const dynamic = "force-dynamic";

export default async function SalesAdminPage() {
  return <SalesDashboard orders={await getSalesOrders()} />;
}
