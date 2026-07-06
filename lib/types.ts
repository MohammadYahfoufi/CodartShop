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
