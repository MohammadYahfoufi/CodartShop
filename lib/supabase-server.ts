import "server-only";

import { createClient } from "@supabase/supabase-js";

export const PRODUCT_IMAGES_BUCKET = "CodartlbShop";
// Avoid making every storefront interaction wait on an offline project.
// Updating environment variables requires a server restart, which clears this state.
const SUPABASE_RETRY_DELAY_MS = 30 * 60_000;

type SupabaseRuntime = typeof globalThis & {
  __codartSupabaseUnavailableUntil?: number;
};

export function isSupabaseTemporarilyUnavailable() {
  return ((globalThis as SupabaseRuntime).__codartSupabaseUnavailableUntil ?? 0) > Date.now();
}

export function markSupabaseUnavailable() {
  (globalThis as SupabaseRuntime).__codartSupabaseUnavailableUntil =
    Date.now() + SUPABASE_RETRY_DELAY_MS;
}

export function markSupabaseAvailable() {
  (globalThis as SupabaseRuntime).__codartSupabaseUnavailableUntil = 0;
}

function getSupabaseUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!configuredUrl) return "";

  try {
    return new URL(configuredUrl).origin;
  } catch {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL must be a valid project URL such as https://project-id.supabase.co.",
    );
  }
}

export const isSupabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    (process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY),
);

export function getSupabaseAdmin() {
  const url = getSupabaseUrl();
  const serverKey =
    process.env.SUPABASE_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serverKey) {
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY to .env.local.",
    );
  }

  return createClient(url, serverKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
