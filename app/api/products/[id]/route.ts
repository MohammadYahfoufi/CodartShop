import { deleteLocalProduct, updateLocalProduct } from "@/lib/local-products";
import { requireAdminAccess } from "@/lib/supabase-auth-server";
import { getSupabaseAdmin, isLocalPersistenceEnabled, isSupabaseTemporarilyUnavailable, PRODUCT_IMAGES_BUCKET } from "@/lib/supabase-server";
import type { ProductImage } from "@/lib/types";
import { broadcastStoreEvent, realtimeTopics } from "@/lib/realtime-server";

const maxImageSize = 5 * 1024 * 1024;

function productErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : error && typeof error === "object" && "message" in error ? String(error.message) : fallback;
  if (/schema cache|column .* does not exist|sale_price|stock_quantity|specifications|featured|category|images/i.test(message)) return "Supabase needs the commerce database upgrade. Run supabase/commerce-upgrade.sql in the Supabase SQL Editor, then try again.";
  return message;
}

function productImages(product: { image_url?: string; image_path?: string; images?: ProductImage[] }) {
  if (Array.isArray(product.images) && product.images.length) return product.images;
  return product.image_path && product.image_url ? [{ path: product.image_path, url: product.image_url }] : [];
}

function parseSpecifications(value: FormDataEntryValue | null): Record<string, string> {
  try {
    const parsed = JSON.parse(String(value ?? "{}")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).slice(0, 30).map(([key, item]) => [key.trim().slice(0, 80), String(item).trim().slice(0, 240)]).filter(([key, item]) => key && item));
  } catch { return {}; }
}

export async function PATCH(request: Request, context: RouteContext<"/api/products/[id]">) {
  const unauthorized = await requireAdminAccess();
  if (unauthorized) return unauthorized;
  try {
    const { id } = await context.params;
    const formData = await request.formData();
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const category = String(formData.get("category") ?? "Accessories").trim();
    const price = Number(formData.get("price"));
    const salePriceRaw = String(formData.get("sale_price") ?? "").trim();
    const salePrice = salePriceRaw ? Number(salePriceRaw) : null;
    const stockQuantity = Number(formData.get("stock_quantity") ?? 0);
    const featured = formData.get("featured") === "true";
    const specifications = parseSpecifications(formData.get("specifications"));
    const images = [...formData.getAll("images"), formData.get("image")].filter((value): value is File => value instanceof File && value.size > 0);

    if (!title || !description || !category || !Number.isFinite(price) || price < 0 || !Number.isInteger(stockQuantity) || stockQuantity < 0) return Response.json({ error: "Enter valid product details, price, and stock." }, { status: 400 });
    if (salePrice !== null && (!Number.isFinite(salePrice) || salePrice < 0 || salePrice >= price)) return Response.json({ error: "Sale price must be lower than the regular price." }, { status: 400 });
    if (images.length > 8 || images.some((image) => image.type !== "image/webp" || image.size > maxImageSize)) return Response.json({ error: "Upload up to 8 WebP images, each smaller than 5 MB." }, { status: 415 });

    if (id.startsWith("local-")) {
      if (!isLocalPersistenceEnabled) return Response.json({ error: "Development products cannot be edited in production." }, { status: 409 });
      const updated = await updateLocalProduct(id, { title, description, price, category, salePrice, stockQuantity, featured, specifications, ...(images[0] ? { image: images[0] } : {}) });
      return updated ? Response.json(updated) : Response.json({ error: "Product not found." }, { status: 404 });
    }
    if (isSupabaseTemporarilyUnavailable()) return Response.json({ error: "Supabase is temporarily unavailable." }, { status: 503 });

    const supabase = getSupabaseAdmin();
    const { data: existing, error: readError } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
    if (readError) throw readError;
    if (!existing) return Response.json({ error: "Product not found." }, { status: 404 });

    let gallery = productImages(existing);
    const uploaded: ProductImage[] = [];
    if (images.length) {
      for (const image of images) {
        const path = `products/${crypto.randomUUID()}.webp`;
        const { error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, image, { contentType: "image/webp", cacheControl: "31536000" });
        if (error) {
          if (uploaded.length) await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove(uploaded.map((item) => item.path));
          throw error;
        }
        uploaded.push({ path, url: supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl, alt: title });
      }
      gallery = uploaded;
    }
    if (!gallery.length) return Response.json({ error: "At least one product image is required." }, { status: 400 });

    const primary = gallery[0];
    const { data, error: updateError } = await supabase.from("products").update({ title, description, category, price, sale_price: salePrice, stock_quantity: stockQuantity, featured, specifications, images: gallery, image_url: primary.url, image_path: primary.path, updated_at: new Date().toISOString() }).eq("id", id).select("*").single();
    if (updateError) {
      if (uploaded.length) await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove(uploaded.map((item) => item.path));
      throw updateError;
    }
    if (uploaded.length) await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove(productImages(existing).map((item) => item.path));
    await broadcastStoreEvent(realtimeTopics.catalog, "catalog-changed");
    return Response.json(data);
  } catch (error) {
    return Response.json({ error: productErrorMessage(error, "Unable to update product.") }, { status: 500 });
  }
}

export async function POST(_request: Request, context: RouteContext<"/api/products/[id]">) {
  const unauthorized = await requireAdminAccess();
  if (unauthorized) return unauthorized;
  try {
    const { id } = await context.params;
    if (id.startsWith("local-")) return Response.json({ error: "Connect Supabase to duplicate this product." }, { status: 409 });
    const supabase = getSupabaseAdmin();
    const { data: existing, error: readError } = await supabase.from("products").select("*").eq("id", id).maybeSingle();
    if (readError) throw readError;
    if (!existing) return Response.json({ error: "Product not found." }, { status: 404 });
    const copied: ProductImage[] = [];
    for (const image of productImages(existing)) {
      const path = `products/${crypto.randomUUID()}.webp`;
      const { error } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).copy(image.path, path);
      if (error) throw error;
      copied.push({ path, url: supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl, alt: `${existing.title} copy` });
    }
    const primary = copied[0];
    const fields = Object.fromEntries(Object.entries(existing).filter(([key]) => !["id", "created_at", "updated_at"].includes(key)));
    const { data, error } = await supabase.from("products").insert({ ...fields, title: `${existing.title} Copy`.slice(0, 120), images: copied, image_path: primary?.path ?? existing.image_path, image_url: primary?.url ?? existing.image_url, featured: false }).select("*").single();
    if (error) throw error;
    await broadcastStoreEvent(realtimeTopics.catalog, "catalog-changed");
    return Response.json(data, { status: 201 });
  } catch (error) {
    return Response.json({ error: productErrorMessage(error, "Unable to duplicate product.") }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/products/[id]">) {
  const unauthorized = await requireAdminAccess();
  if (unauthorized) return unauthorized;
  try {
    const { id } = await context.params;
    if (id.startsWith("local-")) {
      if (!isLocalPersistenceEnabled) return new Response(null, { status: 204 });
      return await deleteLocalProduct(id) ? new Response(null, { status: 204 }) : Response.json({ error: "Product not found." }, { status: 404 });
    }
    const supabase = getSupabaseAdmin();
    const { data: product, error: readError } = await supabase.from("products").select("image_url,image_path,images").eq("id", id).maybeSingle();
    if (readError) throw readError;
    if (!product) return Response.json({ error: "Product not found." }, { status: 404 });
    const [favoritesCleanup, cartCleanup] = await Promise.all([
      supabase.from("favorites").delete().eq("product_id", id),
      supabase.from("cart_items").delete().eq("product_id", id),
    ]);
    if (favoritesCleanup.error) throw favoritesCleanup.error;
    if (cartCleanup.error) throw cartCleanup.error;
    const { error: deleteError } = await supabase.from("products").delete().eq("id", id);
    if (deleteError) throw deleteError;
    const paths = [...new Set(productImages(product).map((image) => image.path).filter(Boolean))];
    if (paths.length) await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove(paths);
    await broadcastStoreEvent(realtimeTopics.catalog, "catalog-changed");
    return new Response(null, { status: 204 });
  } catch (error) {
    return Response.json({ error: productErrorMessage(error, "Unable to delete product.") }, { status: 500 });
  }
}
