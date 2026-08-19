import { Storefront } from "@/components/storefront";
import { getProductsPage } from "@/lib/products";
import { getHeroSlides } from "@/lib/slides";
import { getStorefrontSettings } from "@/lib/storefront-settings";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [productPage, heroSlides, settings] = await Promise.all([
    getProductsPage(),
    getHeroSlides(),
    getStorefrontSettings(),
  ]);

  return <Storefront initialPage={productPage} heroSlides={heroSlides} settings={settings} />;
}
