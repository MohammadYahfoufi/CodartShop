import type { Metadata } from "next";
import { InPersonSale } from "@/components/in-person-sale";
import { getProducts } from "@/lib/products";

export const metadata: Metadata = { title: "In-person sale" };
export const dynamic = "force-dynamic";

export default async function InPersonSalePage() {
  return <InPersonSale initialProducts={await getProducts()} />;
}
