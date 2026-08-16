import "server-only";

import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { localCatalog } from "@/lib/catalog";
import type { PaginatedProducts, Product } from "@/lib/types";

const dataDirectory = path.join(process.cwd(), "data");
const productsFile = path.join(dataDirectory, "products.json");
const uploadsDirectory = path.join(process.cwd(), "public", "uploads");

export async function getManagedLocalProducts(): Promise<Product[]> {
  try {
    const contents = await readFile(productsFile, "utf8");
    const products = JSON.parse(contents) as Product[];
    return Array.isArray(products) ? products : [];
  } catch {
    return [];
  }
}

async function saveManagedProducts(products: Product[]) {
  await mkdir(dataDirectory, { recursive: true });
  await writeFile(productsFile, `${JSON.stringify(products, null, 2)}\n`, "utf8");
}

async function saveImage(image: File, productId: string) {
  await mkdir(uploadsDirectory, { recursive: true });
  const filename = `${productId}.webp`;
  await writeFile(path.join(uploadsDirectory, filename), Buffer.from(await image.arrayBuffer()));
  return {
    image_url: `/uploads/${filename}`,
    image_path: `uploads/${filename}`,
  };
}

async function removeImage(imagePath: string) {
  if (!imagePath.startsWith("uploads/")) return;
  try {
    await unlink(path.join(process.cwd(), "public", imagePath));
  } catch {
    // The metadata can still be removed if the image was already deleted.
  }
}

export async function createLocalProduct(input: {
  title: string;
  description: string;
  price: number;
  image: File;
}) {
  const products = await getManagedLocalProducts();
  const id = `local-${crypto.randomUUID()}`;
  const image = await saveImage(input.image, id);
  const timestamp = new Date().toISOString();
  const product: Product = {
    id,
    title: input.title,
    description: input.description,
    price: input.price,
    ...image,
    created_at: timestamp,
    updated_at: timestamp,
  };
  await saveManagedProducts([product, ...products]);
  return product;
}

export async function updateLocalProduct(
  id: string,
  input: { title: string; description: string; price: number; image?: File },
) {
  const products = await getManagedLocalProducts();
  const existing = products.find((product) => product.id === id);
  if (!existing) return null;
  const nextImage = input.image ? await saveImage(input.image, id) : {
    image_url: existing.image_url,
    image_path: existing.image_path,
  };
  const updated: Product = {
    ...existing,
    title: input.title,
    description: input.description,
    price: input.price,
    ...nextImage,
    updated_at: new Date().toISOString(),
  };
  await saveManagedProducts(products.map((product) => product.id === id ? updated : product));
  return updated;
}

export async function deleteLocalProduct(id: string) {
  const products = await getManagedLocalProducts();
  const existing = products.find((product) => product.id === id);
  if (!existing) return false;
  await saveManagedProducts(products.filter((product) => product.id !== id));
  await removeImage(existing.image_path);
  return true;
}

export async function getLocalProduct(id: string) {
  return (await getManagedLocalProducts()).find((product) => product.id === id)
    ?? localCatalog.find((product) => product.id === id)
    ?? null;
}

export async function getLocalProductsPage(
  requestedPage = 1,
  requestedPageSize = 6,
  search = "",
): Promise<PaginatedProducts> {
  const pageSize = Math.min(24, Math.max(1, requestedPageSize));
  const term = search.trim().toLowerCase();
  const allProducts = [...await getManagedLocalProducts(), ...localCatalog];
  const matchingProducts = term
    ? allProducts.filter((product) =>
        `${product.title} ${product.description}`.toLowerCase().includes(term),
      )
    : allProducts;
  const total = matchingProducts.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(totalPages, Math.max(1, requestedPage));
  const start = (page - 1) * pageSize;
  return {
    products: matchingProducts.slice(start, start + pageSize),
    page,
    pageSize,
    total,
    totalPages,
  };
}
