import type { Product } from "@/lib/types";

function compactSearchText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function searchVariants(query: string) {
  const normalized = compactSearchText(query);
  if (!normalized) return [];

  const variants = new Set([normalized]);
  if (normalized.endsWith("ies") && normalized.length > 3) {
    variants.add(`${normalized.slice(0, -3)}y`);
  }
  if (normalized.endsWith("es") && normalized.length > 2) {
    variants.add(normalized.slice(0, -2));
  }
  if (normalized.endsWith("s") && !normalized.endsWith("ss") && normalized.length > 1) {
    variants.add(normalized.slice(0, -1));
  }

  return [...variants];
}

export function matchesProductSearch(product: Product, query: string) {
  const variants = searchVariants(query);
  if (!variants.length) return true;

  const searchableText = compactSearchText([
    product.title,
    product.description,
    product.category ?? "",
  ].join(" "));

  return variants.some((variant) => searchableText.includes(variant));
}
