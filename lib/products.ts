import {
  collection,
  DocumentData,
  getCountFromServer,
  getDocs,
  limit,
  orderBy,
  query,
  QueryDocumentSnapshot,
  startAfter,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { PaginatedProducts, Product } from "@/lib/types";

const productsCollection = collection(db, "products");

function mapProducts(
  documents: QueryDocumentSnapshot<DocumentData>[],
): Product[] {
  return documents.map((document) => ({
    id: document.id,
    ...document.data(),
  })) as Product[];
}

export async function getProducts(): Promise<Product[]> {
  try {
    const snapshot = await getDocs(
      query(productsCollection, orderBy("created_at", "desc")),
    );

    return mapProducts(snapshot.docs);
  } catch (error) {
    console.error(
      "Unable to load products from Firestore:",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

export async function getProductsPage(
  requestedPage = 1,
  requestedPageSize = 6,
): Promise<PaginatedProducts> {
  const pageSize = Math.min(24, Math.max(1, requestedPageSize));

  try {
    const countSnapshot = await getCountFromServer(productsCollection);
    const total = countSnapshot.data().count;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(totalPages, Math.max(1, requestedPage));
    const sort = orderBy("created_at", "desc");
    let pageQuery;

    if (page === 1) {
      pageQuery = query(productsCollection, sort, limit(pageSize));
    } else {
      const boundarySnapshot = await getDocs(
        query(productsCollection, sort, limit((page - 1) * pageSize)),
      );
      const cursor = boundarySnapshot.docs.at(-1);
      pageQuery = cursor
        ? query(productsCollection, sort, startAfter(cursor), limit(pageSize))
        : query(productsCollection, sort, limit(pageSize));
    }

    const snapshot = await getDocs(pageQuery);

    return {
      products: mapProducts(snapshot.docs),
      page,
      pageSize,
      total,
      totalPages,
    };
  } catch (error) {
    console.error(
      "Unable to load paginated products from Firestore:",
      error instanceof Error ? error.message : error,
    );
    return {
      products: [],
      page: 1,
      pageSize,
      total: 0,
      totalPages: 1,
    };
  }
}
