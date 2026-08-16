export type Product = {
  id: string;
  title: string;
  description: string;
  image_url: string;
  image_path: string;
  price: number;
  created_at: string;
  updated_at: string;
};

export type CartItem = Product & {
  quantity: number;
};

export type PaginatedProducts = {
  products: Product[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type CheckoutDetails = {
  name: string;
  phone: string;
  note: string;
};

export type OrderRequest = {
  customer: CheckoutDetails;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
};

export type OrderReceipt = {
  id: string;
  total: number;
};

export type OrderStatus = "pending" | "confirmed" | "fulfilled" | "cancelled";

export type AdminOrder = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_note: string;
  total: number;
  status: OrderStatus;
  created_at: string;
  order_items: Array<{
    id: number;
    product_title: string;
    unit_price: number;
    quantity: number;
  }>;
};

export type HeroSlide = {
  id: string;
  title: string;
  subtitle: string;
  image_url: string;
  image_path: string;
  cta_label: string;
  cta_href: string;
  sort_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};
