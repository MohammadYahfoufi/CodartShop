export type Product = {
  id: string;
  title: string;
  description: string;
  image_url: string;
  image_path: string;
  price: number;
  sale_price?: number | null;
  category?: string;
  stock_quantity?: number;
  featured?: boolean;
  specifications?: Record<string, string>;
  images?: ProductImage[];
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
  categories?: string[];
};

export type ProductQueryOptions = {
  category?: string;
  sort?: string;
  featured?: boolean;
};

export type ProductImage = {
  url: string;
  path: string;
  alt?: string;
};

export type CheckoutDetails = {
  name: string;
  email: string;
  phone: string;
  address: string;
  area: DeliveryArea;
  paymentMethod: PaymentMethod;
  note: string;
};

export type DeliveryArea = "beirut" | "mount-lebanon" | "north" | "south" | "bekaa";
export type PaymentMethod = "cash-on-delivery" | "whish-money" | "bank-transfer";

export type OrderRequest = {
  customer: CheckoutDetails;
  items: Array<{
    productId: string;
    quantity: number;
  }>;
};

export type OrderReceipt = {
  id: string;
  subtotal: number;
  deliveryFee: number;
  total: number;
};

export type OrderStatus = "pending" | "confirmed" | "shipped" | "delivered" | "cancelled";

export type AdminOrder = {
  id: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  delivery_address?: string;
  delivery_area?: DeliveryArea;
  delivery_fee?: number;
  payment_method?: PaymentMethod;
  customer_note: string;
  subtotal?: number;
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

export type AccountOrder = Pick<AdminOrder, "id" | "total" | "status" | "created_at" | "order_items">;

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
