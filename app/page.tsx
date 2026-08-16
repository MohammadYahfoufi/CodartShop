import { Storefront } from "@/components/storefront";
import { getProductsPage } from "@/lib/products";
import { getHeroSlides } from "@/lib/slides";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [productPage, heroSlides] = await Promise.all([
    getProductsPage(),
    getHeroSlides(),
  ]);

  return <Storefront initialPage={productPage} heroSlides={heroSlides} />;
}
