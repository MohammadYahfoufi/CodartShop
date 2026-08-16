import { getProductsPage } from "@/lib/products";
import { createLocalProduct } from "@/lib/local-products";
import {
  getSupabaseAdmin,
  isSupabaseConfigured,
  isSupabaseTemporarilyUnavailable,
  markSupabaseUnavailable,
  PRODUCT_IMAGES_BUCKET,
} from "@/lib/supabase-server";
import { requireAdminAccess } from "@/lib/supabase-auth-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") ?? 1);
  const pageSize = Number(searchParams.get("pageSize") ?? 6);
  const search = searchParams.get("q") ?? "";

  return Response.json(
    await getProductsPage(
      Number.isFinite(page) ? page : 1,
      Number.isFinite(pageSize) ? pageSize : 6,
      search,
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
    const image = formData.get("image");

    if (!title || !description || !Number.isFinite(price) || price < 0 || !(image instanceof File) || image.size === 0) {
      return Response.json({ error: "Title, description, a valid price, and image are required." }, { status: 400 });
    }
    if (image.type !== "image/webp") {
      return Response.json({ error: "Images must be converted to WebP before upload." }, { status: 415 });
    }
    if (image.size > 5 * 1024 * 1024) {
      return Response.json({ error: "The optimized image must be smaller than 5 MB." }, { status: 413 });
    }

    if (!isSupabaseConfigured || isSupabaseTemporarilyUnavailable()) {
      return Response.json(
        await createLocalProduct({ title, description, price, image }),
        { status: 201 },
      );
    }

    const supabase = getSupabaseAdmin();
    const imagePath = `${crypto.randomUUID()}.webp`;
    const { error: uploadError } = await supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .upload(imagePath, image, {
        contentType: "image/webp",
        cacheControl: "31536000",
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const imageUrl = supabase.storage
      .from(PRODUCT_IMAGES_BUCKET)
      .getPublicUrl(imagePath).data.publicUrl;
    const product = {
      title,
      description,
      price,
      image_url: imageUrl,
      image_path: imagePath,
    };
    const { data, error: insertError } = await supabase
      .from("products")
      .insert(product)
      .select("*")
      .single();

    if (insertError) {
      await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([imagePath]);
      throw insertError;
    }

    return Response.json(data, { status: 201 });
  } catch (error) {
    markSupabaseUnavailable();
    return Response.json({ error: error instanceof Error ? error.message : "Unable to create product." }, { status: 500 });
  }
}
