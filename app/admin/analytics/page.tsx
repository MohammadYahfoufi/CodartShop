import type { Metadata } from "next";
import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { getAnalytics } from "@/lib/analytics";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

export default async function AnalyticsAdminPage() {
  return <AnalyticsDashboard rows={await getAnalytics(30)} />;
}
