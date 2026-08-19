import type { Metadata } from "next";
import { OrdersManager } from "@/components/orders-manager";
import { getAdminOverview } from "@/lib/orders";

export const metadata: Metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

export default async function OrdersAdminPage() {
  return <OrdersManager initialOrders={(await getAdminOverview()).orders} />;
}
