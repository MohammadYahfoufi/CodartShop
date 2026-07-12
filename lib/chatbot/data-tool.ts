import { readFile } from 'fs/promises';
import path from 'path';

type Catalog = {
  products: Array<{
    id: string;
    name: string;
    categoryId: string;
    price: number;
    currency: string;
    description: string;
    inStock: boolean;
  }>;
  categories: Array<{
    id: string;
    name: string;
    description: string;
  }>;
};

const catalogPath = path.join(process.cwd(), 'data', 'catalog.json');

async function loadCatalog() {
  const raw = await readFile(catalogPath, 'utf8');
  return JSON.parse(raw) as Catalog;
}

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  return 'http://localhost:3000';
}

function shouldQueryProducts(message: string) {
  return /\b(products?|items?|catalog|prices?)\b/i.test(message);
}

function shouldQueryCategories(message: string) {
  return /\b(categories?|category|groups?)\b/i.test(message);
}

export async function getToolContext(message: string) {
  const tasks: string[] = [];

  if (shouldQueryProducts(message)) tasks.push('products');
  if (shouldQueryCategories(message)) tasks.push('categories');

  if (tasks.length === 0) {
    return [];
  }

  const baseUrl = getBaseUrl();
  const results: Array<{ source: string; data: unknown }> = [];

  for (const task of tasks) {
    const endpoint = `${baseUrl}/api/chatbot/data/${task}`;
    const response = await fetch(endpoint, { cache: 'no-store' });
    if (!response.ok) {
      console.warn(
        `Catalog endpoint request failed for ${task}: ${response.status}`,
      );
      continue;
    }
    results.push({ source: endpoint, data: await response.json() });
  }

  return results;
}

export async function loadCatalogForEndpoint(kind: 'products' | 'categories') {
  const catalog = await loadCatalog();
  return catalog[kind];
}
