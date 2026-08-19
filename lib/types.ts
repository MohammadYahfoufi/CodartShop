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
export type PaymentMethod = "cash-on-delivery" | "whish-money";

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

export type StorefrontSettings = {
  site_name: string;
  site_logo_url: string;
  site_logo_path: string;
  header_shop_label: string;
  header_story_label: string;
  header_contact_label: string;
  header_track_label: string;
  header_saved_label: string;
  header_cart_label: string;
  hero_eyebrow: string;
  fallback_hero_title: string;
  fallback_hero_subtitle: string;
  fallback_hero_cta_label: string;
  fallback_hero_cta_href: string;
  catalog_eyebrow: string;
  catalog_title: string;
  catalog_search_placeholder: string;
  product_background_color: string;
  story_eyebrow: string;
  story_title: string;
  story_body: string;
  story_image_url: string;
  story_image_path: string;
  footer_description: string;
  footer_nav_heading: string;
  footer_shop_label: string;
  footer_saved_label: string;
  footer_track_label: string;
  footer_story_label: string;
  footer_contact_eyebrow: string;
  footer_contact_title: string;
  footer_contact_body: string;
  footer_whatsapp_label: string;
  whatsapp_number: string;
  footer_copyright: string;
  footer_tagline: string;
  seo_title: string;
  seo_description: string;
};
