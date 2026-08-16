import { notFound } from "next/navigation";
import { Storefront } from "@/components/storefront";
import { getProductById, getProductsPage } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function ProductPage(props: PageProps<"/products/[id]">) {
  const { id } = await props.params;
  const product = await getProductById(id);

  if (!product) notFound();

  const productPage = await getProductsPage(1, 24);
  const existsInPage = productPage.products.some((item) => item.id === product.id);

  return (
    <Storefront
      initialPage={{
        ...productPage,
        products: existsInPage
          ? productPage.products
          : [product, ...productPage.products],
      }}
      focusProductId={product.id}
    />
  );
}
