import { getLocalProductsPage, localCatalog } from "@/lib/catalog";
import {
  getSupabaseAdmin,
  isSupabaseConfigured,
  isSupabaseTemporarilyUnavailable,
  markSupabaseAvailable,
  markSupabaseUnavailable,
} from "@/lib/supabase-server";
import type { PaginatedProducts, Product } from "@/lib/types";

function reportSupabaseError(context: string, error: unknown) {
  console.warn(
    `${context}:`,
    error instanceof Error ? error.message : error,
  );
}

export async function getProducts(): Promise<Product[]> {
  if (!isSupabaseConfigured || isSupabaseTemporarilyUnavailable()) return [];

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
    return [];
  }
}

export async function getProductsPage(
  requestedPage = 1,
  requestedPageSize = 6,
  requestedSearch = "",
): Promise<PaginatedProducts> {
  const pageSize = Math.min(24, Math.max(1, requestedPageSize));
  const search = requestedSearch.trim().slice(0, 80);
  if (!isSupabaseConfigured || isSupabaseTemporarilyUnavailable()) {
    return getLocalProductsPage(requestedPage, pageSize, search);
  }

  try {
    const requested = Math.max(1, requestedPage);
    const from = (requested - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = getSupabaseAdmin()
      .from("products")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (search) {
      const safeSearch = search.replace(/[,%()]/g, " ").replace(/\s+/g, " ").trim();
      if (safeSearch) {
        query = query.or(`title.ilike.%${safeSearch}%,description.ilike.%${safeSearch}%`);
      }
    }

    const { data, error, count } = await query
      .range(from, to);

    if (error) throw error;
    markSupabaseAvailable();
    const total = count ?? 0;
    if (!total && !search) return getLocalProductsPage(requestedPage, pageSize);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    if (requested > totalPages) {
      return getProductsPage(totalPages, pageSize, search);
    }

    return {
      products: (data ?? []) as Product[],
      page: requested,
      pageSize,
      total,
      totalPages,
    };
  } catch (error) {
    markSupabaseUnavailable();
    reportSupabaseError("Unable to load products from Supabase", error);
    return getLocalProductsPage(requestedPage, pageSize, search);
  }
}

export async function getProductById(id: string): Promise<Product | null> {
  const localProduct = localCatalog.find((product) => product.id === id);
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
