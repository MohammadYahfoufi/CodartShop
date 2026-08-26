import { getFeaturedProducts } from "@/lib/products";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json(await getFeaturedProducts());
}
