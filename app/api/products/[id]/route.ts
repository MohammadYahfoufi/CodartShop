import {
  getSupabaseAdmin,
  isSupabaseTemporarilyUnavailable,
  PRODUCT_IMAGES_BUCKET,
} from "@/lib/supabase-server";
import { deleteLocalProduct, updateLocalProduct } from "@/lib/local-products";
import { requireAdminAccess } from "@/lib/supabase-auth-server";

export async function PATCH(request: Request, context: RouteContext<"/api/products/[id]">) {
  const unauthorized = await requireAdminAccess();
  if (unauthorized) return unauthorized;
  try {
    const { id } = await context.params;
    const formData = await request.formData();
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const price = Number(formData.get("price"));
    const image = formData.get("image");

    if (!title || !description || !Number.isFinite(price) || price < 0) {
      return Response.json({ error: "Title, description, and a valid price are required." }, { status: 400 });
    }
    if (image instanceof File && image.size > 0 && image.type !== "image/webp") {
      return Response.json({ error: "Images must be converted to WebP before upload." }, { status: 415 });
    }
    if (image instanceof File && image.size > 5 * 1024 * 1024) {
      return Response.json({ error: "The optimized image must be smaller than 5 MB." }, { status: 413 });
    }

    if (id.startsWith("local-")) {
      const updated = await updateLocalProduct(id, {
        title,
        description,
        price,
        ...(image instanceof File && image.size > 0 ? { image } : {}),
      });
      return updated
        ? Response.json(updated)
        : Response.json({ error: "Product not found." }, { status: 404 });
    }
    if (isSupabaseTemporarilyUnavailable()) {
      return Response.json({ error: "Supabase is offline; only locally added products can be edited." }, { status: 503 });
    }

    const supabase = getSupabaseAdmin();
    const { data: existing, error: readError } = await supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (readError) throw readError;
    if (!existing) {
      return Response.json({ error: "Product not found." }, { status: 404 });
    }

    let imagePath = existing.image_path;
    let imageUrl = existing.image_url;
    let uploadedPath = "";

    if (image instanceof File && image.size > 0) {
      if (image.type !== "image/webp") {
        return Response.json({ error: "Images must be converted to WebP before upload." }, { status: 415 });
      }
      uploadedPath = `${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await supabase.storage
        .from(PRODUCT_IMAGES_BUCKET)
        .upload(uploadedPath, image, {
          contentType: "image/webp",
          cacheControl: "31536000",
        });
      if (uploadError) throw uploadError;
      imagePath = uploadedPath;
      imageUrl = supabase.storage
        .from(PRODUCT_IMAGES_BUCKET)
        .getPublicUrl(uploadedPath).data.publicUrl;
    }

    const updatedProduct = {
      title,
      description,
      price,
      image_url: imageUrl,
      image_path: imagePath,
      updated_at: new Date().toISOString(),
    };
    const { data, error: updateError } = await supabase
      .from("products")
      .update(updatedProduct)
      .eq("id", id)
      .select("*")
      .single();

    if (updateError) {
      if (uploadedPath) {
        await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([uploadedPath]);
      }
      throw updateError;
    }
    if (uploadedPath && existing.image_path) {
      await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([existing.image_path]);
    }

    return Response.json(data);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to update product." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/products/[id]">) {
  const unauthorized = await requireAdminAccess();
  if (unauthorized) return unauthorized;
  try {
    const { id } = await context.params;
    if (id.startsWith("local-")) {
      return await deleteLocalProduct(id)
        ? new Response(null, { status: 204 })
        : Response.json({ error: "Product not found." }, { status: 404 });
    }
    if (isSupabaseTemporarilyUnavailable()) {
      return Response.json({ error: "Supabase is offline; only locally added products can be deleted." }, { status: 503 });
    }
    const supabase = getSupabaseAdmin();
    const { data: product, error: readError } = await supabase
      .from("products")
      .select("image_path")
      .eq("id", id)
      .maybeSingle();
    if (readError) throw readError;
    if (!product) {
      return Response.json({ error: "Product not found." }, { status: 404 });
    }

    const { error: deleteError } = await supabase
      .from("products")
      .delete()
      .eq("id", id);
    if (deleteError) throw deleteError;

    if (product.image_path) {
      await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([product.image_path]);
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to delete product." }, { status: 500 });
  }
}
