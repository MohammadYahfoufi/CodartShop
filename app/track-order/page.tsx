import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderTracker } from "@/components/order-tracker";

export const metadata: Metadata = { title: "Track your order" };

export default function TrackOrderPage() {
  return <Suspense fallback={<main className="tracking-page" />}><OrderTracker /></Suspense>;
}
