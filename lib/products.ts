import {
  getLocalFeaturedProducts,
  getLocalProduct,
  getLocalProductsPage,
  getManagedLocalProducts,
} from "@/lib/local-products";
import {
  getSupabaseAdmin,
  isSupabaseConfigured,
  isSupabaseTemporarilyUnavailable,
  markSupabaseAvailable,
  markSupabaseUnavailable,
  isLocalPersistenceEnabled,
} from "@/lib/supabase-server";
import type { PaginatedProducts, Product, ProductQueryOptions } from "@/lib/types";
import { matchesProductSearch } from "@/lib/product-search";

function reportSupabaseError(context: string, error: unknown) {
  console.warn(
    `${context}:`,
    error instanceof Error ? error.message : error,
  );
}

export async function getFeaturedProducts(): Promise<Product[]> {
  if (!isSupabaseConfigured || isSupabaseTemporarilyUnavailable()) {
    return isLocalPersistenceEnabled ? getLocalFeaturedProducts() : [];
  }

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("products")
      .select("*")
      .eq("featured", true)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    markSupabaseAvailable();
    return (data ?? []) as Product[];
  } catch (error) {
    markSupabaseUnavailable();
    reportSupabaseError("Unable to load trending products from Supabase", error);
    return isLocalPersistenceEnabled ? getLocalFeaturedProducts() : [];
  }
}

export async function getProducts(): Promise<Product[]> {
  if (!isSupabaseConfigured || isSupabaseTemporarilyUnavailable()) {
    return isLocalPersistenceEnabled ? getManagedLocalProducts() : [];
  }

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("products")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;
    markSupabaseAvailable();
    return (data ?? []) as Product[];
  } catch (error) {
    markSupabaseUnavailable();
    reportSupabaseError("Unable to load products from Supabase", error);
    return isLocalPersistenceEnabled ? getManagedLocalProducts() : [];
  }
}

export async function getProductsPage(
  requestedPage = 1,
  requestedPageSize = 6,
  requestedSearch = "",
  options: ProductQueryOptions = {},
): Promise<PaginatedProducts> {
  const pageSize = Math.min(24, Math.max(1, requestedPageSize));
  const search = requestedSearch.trim().slice(0, 80);
  if (!isSupabaseConfigured || isSupabaseTemporarilyUnavailable()) {
    return isLocalPersistenceEnabled
      ? await getLocalProductsPage(requestedPage, pageSize, search, options)
      : { products: [], page: 1, pageSize, total: 0, totalPages: 1, categories: [] };
  }

  try {
    const requested = Math.max(1, requestedPage);
    const from = (requested - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = getSupabaseAdmin()
      .from("products")
      .select("*", { count: "exact" });

    const category = String(options.category ?? "").trim().slice(0, 80);
    if (category) query = query.eq("category", category);
    if (options.featured) query = query.eq("featured", true);
    if (options.sort === "price-asc") query = query.order("price", { ascending: true });
    else if (options.sort === "price-desc") query = query.order("price", { ascending: false });
    else query = query.order("created_at", { ascending: false });

    const { data, error, count } = search
      ? await query
      : await query.range(from, to);

    if (error) throw error;
    markSupabaseAvailable();
    const matchedProducts = search
      ? ((data ?? []) as Product[]).filter((product) => matchesProductSearch(product, search))
      : (data ?? []) as Product[];
    const total = search ? matchedProducts.length : count ?? 0;
    const { data: categoryRows } = await getSupabaseAdmin().from("products").select("category").not("category", "is", null);
    const categories = [...new Set((categoryRows ?? []).map((row) => String(row.category)).filter(Boolean))].sort();

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (!search && requested > totalPages) {
      return getProductsPage(totalPages, pageSize, search, options);
    }

    const page = Math.min(requested, totalPages);
    const products = search
      ? matchedProducts.slice((page - 1) * pageSize, page * pageSize)
      : matchedProducts;

    return {
      products,
      page,
      pageSize,
      total,
      totalPages,
      categories,
    };
  } catch (error) {
    markSupabaseUnavailable();
    reportSupabaseError("Unable to load products from Supabase", error);
    return isLocalPersistenceEnabled
      ? await getLocalProductsPage(requestedPage, pageSize, search, options)
      : { products: [], page: 1, pageSize, total: 0, totalPages: 1, categories: [] };
  }
}

export async function getProductById(id: string): Promise<Product | null> {
  const localProduct = isLocalPersistenceEnabled ? await getLocalProduct(id) : null;
  if (localProduct) return localProduct;
  if (!isSupabaseConfigured || isSupabaseTemporarilyUnavailable()) return null;

  try {
    const { data, error } = await getSupabaseAdmin()
      .from("products")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    markSupabaseAvailable();
    return (data as Product | null) ?? null;
  } catch (error) {
    markSupabaseUnavailable();
    reportSupabaseError("Unable to load product from Supabase", error);
    return null;
  }
}
