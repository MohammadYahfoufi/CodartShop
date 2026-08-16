import { Storefront } from "@/components/storefront";
import { getProductsPage } from "@/lib/products";
import { getStorefrontSettings } from "@/lib/storefront-settings";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const [productPage, settings] = await Promise.all([getProductsPage(1, 24), getStorefrontSettings()]);

  return (
    <Storefront
      initialPage={productPage}
      initialCheckoutStep="cart"
      initialPanelOpen
      settings={settings}
    />
  );
}
