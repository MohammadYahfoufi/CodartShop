import { Storefront } from "@/components/storefront";
import { getFeaturedProducts, getProductsPage } from "@/lib/products";
import { getHeroSlides } from "@/lib/slides";
import { getStorefrontSettings } from "@/lib/storefront-settings";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [productPage, trendingProducts, heroSlides, settings] = await Promise.all([
    getProductsPage(),
    getFeaturedProducts(),
    getHeroSlides(),
    getStorefrontSettings(),
  ]);

  return <Storefront initialPage={productPage} initialTrendingProducts={trendingProducts} heroSlides={heroSlides} settings={settings} />;
}
