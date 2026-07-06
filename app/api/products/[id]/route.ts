import {
  deleteDoc,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  getSupabaseAdmin,
  PRODUCT_IMAGES_BUCKET,
} from "@/lib/supabase-server";

export async function PATCH(request: Request, context: RouteContext<"/api/products/[id]">) {
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

    const productRef = doc(db, "products", id);
    const productSnapshot = await getDoc(productRef);
    if (!productSnapshot.exists()) {
      return Response.json({ error: "Product not found." }, { status: 404 });
    }
    const existing = productSnapshot.data();
    const supabase = getSupabaseAdmin();

    let imagePath = existing.image_path;
    let imageUrl = existing.image_url;
    let uploadedPath = "";

    if (image instanceof File && image.size > 0) {
      if (image.type !== "image/webp") {
        return Response.json({ error: "Images must be converted to WebP before upload." }, { status: 415 });
      }
      uploadedPath = `${crypto.randomUUID()}.webp`;
      const { error: uploadError } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(uploadedPath, image, {
        contentType: "image/webp",
        cacheControl: "31536000",
      });
      if (uploadError) throw uploadError;
      imagePath = uploadedPath;
      imageUrl = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(uploadedPath).data.publicUrl;
    }

    const updatedProduct = {
      title,
      description,
      price,
      image_url: imageUrl,
      image_path: imagePath,
      updated_at: new Date().toISOString(),
    };

    try {
      await updateDoc(productRef, updatedProduct);
    } catch (error) {
      if (uploadedPath) await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([uploadedPath]);
      throw error;
    }
    if (uploadedPath && existing.image_path) await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([existing.image_path]);

    return Response.json({
      id,
      ...existing,
      ...updatedProduct,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to update product." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, context: RouteContext<"/api/products/[id]">) {
  try {
    const { id } = await context.params;
    const productRef = doc(db, "products", id);
    const productSnapshot = await getDoc(productRef);
    if (!productSnapshot.exists()) {
      return Response.json({ error: "Product not found." }, { status: 404 });
    }
    const product = productSnapshot.data();
    const supabase = getSupabaseAdmin();
    await deleteDoc(productRef);
    if (product.image_path) await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([product.image_path]);

    return new Response(null, { status: 204 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to delete product." }, { status: 500 });
  }
}
