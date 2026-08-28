import type { CartItem, CheckoutDetails, Product } from "@/lib/types";
import { matchesProductSearch } from "@/lib/product-search";

export const CART_KEY = "codart-cart";
export const FAVORITES_KEY = "codart-favorites";
export const VISITOR_KEY = "codart-visitor-id";
export const LEGACY_CART_KEY = "nexora-cart";

export const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export function readStoredJson<T>(key: string, fallback: T): T {
  try {
    const saved = localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    localStorage.removeItem(key);
    return fallback;
  }
}

export function filterProducts(
  products: Product[],
  query: string,
  favoriteIds: string[],
  filter: "all" | "favorites",
) {
  return products.filter((product) => {
    const matchesFilter =
      filter === "all" || favoriteIds.includes(product.id);
    const matchesSearch = matchesProductSearch(product, query);

    return matchesFilter && matchesSearch;
  });
}

export function getCartTotals(cart: CartItem[]) {
  const subtotal = cart.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0,
  );
  const serviceReserve = cart.length ? Math.max(5, subtotal * 0.04) : 0;

  return {
    subtotal,
    serviceReserve,
    total: subtotal + serviceReserve,
  };
}

export function formatOrderMessage(
  cart: CartItem[],
  details: CheckoutDetails,
) {
  const { subtotal, serviceReserve, total } = getCartTotals(cart);
  const customerLines = [
    details.name && `Name: ${details.name}`,
    details.phone && `Phone: ${details.phone}`,
    details.note && `Note: ${details.note}`,
  ].filter(Boolean);

  return [
    "Hello Codart! I would like to reserve this order:",
    "",
    ...cart.map(
      (item, index) =>
        `${index + 1}. ${item.title} x ${item.quantity} - ${money.format(
          item.price * item.quantity,
        )}`,
    ),
    "",
    `Subtotal: ${money.format(subtotal)}`,
    `Service reserve: ${money.format(serviceReserve)}`,
    `Estimated total: ${money.format(total)}`,
    ...(customerLines.length ? ["", "Customer details:", ...customerLines] : []),
    "",
    "Please confirm availability and payment options.",
  ].join("\n");
}
