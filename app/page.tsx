import { Storefront } from "@/components/storefront";
import { getProductsPage } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function Home() {
  const productPage = await getProductsPage();

  return <Storefront initialPage={productPage} />;
}
