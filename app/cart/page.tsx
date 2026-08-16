import { Storefront } from "@/components/storefront";
import { getProductsPage } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const productPage = await getProductsPage(1, 24);

  return (
    <Storefront
      initialPage={productPage}
      initialCheckoutStep="cart"
      initialPanelOpen
    />
  );
}
