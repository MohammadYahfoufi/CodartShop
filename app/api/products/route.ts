import { addDoc, collection } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getProductsPage } from "@/lib/products";
import {
  getSupabaseAdmin,
  PRODUCT_IMAGES_BUCKET,
} from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get("page") ?? 1);
  const pageSize = Number(searchParams.get("pageSize") ?? 6);

  return Response.json(
    await getProductsPage(
      Number.isFinite(page) ? page : 1,
      Number.isFinite(pageSize) ? pageSize : 6,
    ),
  );
}

export async function POST(request: Request) {
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

    const supabase = getSupabaseAdmin();
    const imagePath = `${crypto.randomUUID()}.webp`;
    const { error: uploadError } = await supabase.storage.from(PRODUCT_IMAGES_BUCKET).upload(imagePath, image, {
      contentType: "image/webp",
      cacheControl: "31536000",
      upsert: false,
    });
    if (uploadError) throw uploadError;

    const { data: publicData } = supabase.storage.from(PRODUCT_IMAGES_BUCKET).getPublicUrl(imagePath);
    const now = new Date().toISOString();
    const product = {
      title,
      description,
      price,
      image_url: publicData.publicUrl,
      image_path: imagePath,
      created_at: now,
      updated_at: now,
    };

    try {
      const document = await addDoc(collection(db, "products"), product);
      return Response.json({ id: document.id, ...product }, { status: 201 });
    } catch (error) {
      await supabase.storage.from(PRODUCT_IMAGES_BUCKET).remove([imagePath]);
      throw error;
    }
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Unable to create product." }, { status: 500 });
  }
}
