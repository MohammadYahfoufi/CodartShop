import { Storefront } from "@/components/storefront";
import { getProductsPage } from "@/lib/products";

export default async function Home() {
  const productPage = await getProductsPage();

  return <Storefront initialPage={productPage} />;
}
