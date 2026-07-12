import { createClient as createSupabaseClient } from '@supabase/supabase-js';

export const PRODUCT_IMAGES_BUCKET = 'CodartlbShop';

function getSupabaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!configuredUrl) return '';

  try {
    return new URL(configuredUrl).origin;
  } catch {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL must be a valid project URL such as https://project-id.supabase.co.',
    );
  }
}

export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
);

export function getSupabaseAdmin() {
  const url = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local.',
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function createClient() {
  return getSupabaseAdmin();
}
