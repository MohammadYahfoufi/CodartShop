import type { Product } from "@/lib/types";

export const localCatalog: Product[] = [
  {
    id: "codart-gan-65w-charger",
    title: "65W GaN Fast Charger",
    description: "Compact USB-C wall charger for phones, tablets, AirPods, and laptops with fast, stable power.",
    image_url: "",
    image_path: "local/gan-65w-charger",
    price: 39,
    created_at: "2026-07-01T10:00:00.000Z",
    updated_at: "2026-07-01T10:00:00.000Z",
  },
  {
    id: "codart-magsafe-powerbank",
    title: "MagSafe Power Bank",
    description: "Slim 10,000mAh wireless power bank with USB-C input/output and magnetic phone charging.",
    image_url: "",
    image_path: "local/magsafe-powerbank",
    price: 49,
    created_at: "2026-07-02T10:00:00.000Z",
    updated_at: "2026-07-02T10:00:00.000Z",
  },
  {
    id: "codart-airpods-pro-case",
    title: "AirPods Pro Case",
    description: "Protective soft-touch case with keyring clip, wireless charging support, and clean everyday fit.",
    image_url: "",
    image_path: "local/airpods-pro-case",
    price: 16,
    created_at: "2026-07-03T10:00:00.000Z",
    updated_at: "2026-07-03T10:00:00.000Z",
  },
  {
    id: "codart-braided-usbc-cable",
    title: "Braided USB-C Cable",
    description: "Durable 100W braided cable for charging phones, tablets, power banks, and laptops.",
    image_url: "",
    image_path: "local/braided-usbc-cable",
    price: 12,
    created_at: "2026-07-04T10:00:00.000Z",
    updated_at: "2026-07-04T10:00:00.000Z",
  },
  {
    id: "codart-car-fast-charger",
    title: "Dual Car Fast Charger",
    description: "USB-C and USB-A car charger for quick top-ups during commutes, deliveries, and road trips.",
    image_url: "",
    image_path: "local/car-fast-charger",
    price: 18,
    created_at: "2026-07-05T10:00:00.000Z",
    updated_at: "2026-07-05T10:00:00.000Z",
  },
  {
    id: "codart-wireless-earbuds",
    title: "Wireless Earbuds",
    description: "Everyday Bluetooth earbuds with compact charging case, touch controls, and clear call audio.",
    image_url: "",
    image_path: "local/wireless-earbuds",
    price: 34,
    created_at: "2026-07-06T10:00:00.000Z",
    updated_at: "2026-07-06T10:00:00.000Z",
  },
  {
    id: "codart-desk-charging-pad",
    title: "3-in-1 Charging Pad",
    description: "Desk charger for phone, earbuds, and watch with a low-profile base and tidy cable setup.",
    image_url: "",
    image_path: "local/desk-charging-pad",
    price: 44,
    created_at: "2026-07-07T10:00:00.000Z",
    updated_at: "2026-07-07T10:00:00.000Z",
  },
  {
    id: "codart-phone-stand",
    title: "Aluminum Phone Stand",
    description: "Stable phone stand for video calls, charging, and desk use with a compact foldable build.",
    image_url: "",
    image_path: "local/phone-stand",
    price: 15,
    created_at: "2026-07-08T10:00:00.000Z",
    updated_at: "2026-07-08T10:00:00.000Z",
  },
];

export function getLocalProductsPage(
  requestedPage = 1,
  requestedPageSize = 6,
  search = "",
) {
  const pageSize = Math.min(24, Math.max(1, requestedPageSize));
  const term = search.trim().toLowerCase();
  const matchingProducts = term
    ? localCatalog.filter((product) =>
        `${product.title} ${product.description}`.toLowerCase().includes(term),
      )
    : localCatalog;
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
