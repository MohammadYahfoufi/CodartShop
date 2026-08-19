import { getProductsPage } from "@/lib/products";
import { createLocalProduct } from "@/lib/local-products";
import {
  getSupabaseAdmin,
  isLocalPersistenceEnabled,
  isSupabaseConfigured,
  isSupabaseTemporarilyUnavailable,
  markSupabaseUnavailable,
  PRODUCT_IMAGES_BUCKET,
} from "@/lib/supabase-server";
import { requireAdminAccess } from "@/lib/supabase-auth-server";
import { broadcastStoreEvent, realtimeTopics } from "@/lib/realtime-server";

export const dynamic = "force-dynamic";

function productErrorMessage(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : error && typeof error === "object" && "message" in error
      ? String(error.message)
      : "Unable to create product.";
  if (/schema cache|column .* does not exist|sale_price|stock_quantity|specifications|featured|category|images/i.test(message)) {
    return "Supabase needs the commerce database upgrade. Run supabase/commerce-upgrade.sql in the Supabase SQL Editor, then try again.";
  }
  if (/bucket|storage|object/i.test(message)) {
    return `Supabase Storage error: ${message}`;
  }
  return message;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") ?? 1);
  const pageSize = Number(searchParams.get("pageSize") ?? 6);
  const search = searchParams.get("q") ?? "";
  const category = searchParams.get("category") ?? "";
  const sort = searchParams.get("sort") ?? "newest";
  const featured = searchParams.get("featured") === "true";

  return Response.json(
    await getProductsPage(
      Number.isFinite(page) ? page : 1,
      Number.isFinite(pageSize) ? pageSize : 6,
      search,
      { category, sort, featured },
    ),
  );
}

export async function POST(request: Request) {
  const unauthorized = await requireAdminAccess();
  if (unauthorized) return unauthorized;
  try {
    const formData = await request.formData();
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const price = Number(formData.get("price"));
    const salePriceRaw = String(formData.get("sale_price") ?? "").trim();
    const salePrice = salePriceRaw ? Number(salePriceRaw) : null;
    const category = String(formData.get("category") ?? "Accessories").trim();
    const stockQuantity = Number(formData.get("stock_quantity") ?? 0);
    const featured = formData.get("featured") === "true";
    const specifications = parseSpecifications(formData.get("specifications"));
    const images = [...formData.getAll("images"), formData.get("image")]
      .filter((value): value is File => value instanceof File && value.size > 0);

    if (!title || !description || !category || !Number.isFinite(price) || price < 0 || !Number.isInteger(stockQuantity) || stockQuantity < 0 || !images.length) {
      return Response.json({ error: "Title, description, category, stock, a valid price, and at least one image are required." }, { status: 400 });
    }
    if (salePrice !== null && (!Number.isFinite(salePrice) || salePrice < 0 || salePrice >= price)) {
      return Response.json({ error: "Sale price must be lower than the regular price." }, { status: 400 });
    }
    if (images.length > 8 || images.some((image) => image.type !== "image/webp" || image.size > 5 * 1024 * 1024)) {
      return Response.json({ error: "Upload up to 8 WebP images, each smaller than 5 MB." }, { status: 415 });
    }

    if (isLocalPersistenceEnabled && (!isSupabaseConfigured || isSupabaseTemporarilyUnavailable())) {
      return Response.json(
        await createLocalProduct({ title, description, price, image: images[0], category, salePrice, stockQuantity, featured, specifications }),
        { status: 201 },
      );
    }
    if (!isSupabaseConfigured) {
      return Response.json({ error: "Supabase Storage is not configured for production uploads." }, { status: 503 });
    }

    const supabase = getSupabaseAdmin();
    const storedImages: Array<{ path: string; url: string; alt: string }> = [];
    for (const image of images) {
      const path = `products/${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(path, image, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
      if (uploadError) {
        if (storedImages.length) await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove(storedImages.map((item) => item.path));
        throw uploadError;
      }
      storedImages.push({ path, url: supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(path).data.publicUrl, alt: title });
    }
    const primary = storedImages[0];
    const product = {
      title,
      description,
      price,
      sale_price: salePrice,
      category,
      stock_quantity: stockQuantity,
      featured,
      specifications,
      images: storedImages,
      image_url: primary.url,
      image_path: primary.path,
    };
    const { data, error: insertError } = await supabase
      .from("products")
      .insert(product)
      .select("*")
      .single();

    if (insertError) {
      await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove(storedImages.map((item) => item.path));
      throw insertError;
    }

    await broadcastStoreEvent(realtimeTopics.catalog, "catalog-changed");
    return Response.json(data, { status: 201 });
  } catch (error) {
    markSupabaseUnavailable();
    console.warn("Unable to create product:", productErrorMessage(error));
    return Response.json({ error: productErrorMessage(error) }, { status: 500 });
  }
}

function parseSpecifications(value: FormDataEntryValue | null): Record<string, string> {
  try {
    const parsed = JSON.parse(String(value ?? "{}")) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).slice(0, 30).map(([key, item]) => [key.trim().slice(0, 80), String(item).trim().slice(0, 240)]).filter(([key, item]) => key && item));
  } catch {
    return {};
  }
}
