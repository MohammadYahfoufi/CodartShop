import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseAuthConfigured = Boolean(supabaseUrl && supabaseKey);

export async function createSupabaseAuthServerClient() {
  if (!supabaseUrl || !supabaseKey) return null;
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components cannot write cookies; proxy.ts refreshes them.
        }
      },
    },
  });
}

export async function getAuthClaims(): Promise<Record<string, unknown> | null> {
  const supabase = await createSupabaseAuthServerClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getClaims();
  if (!error && data?.claims) {
    return data.claims as Record<string, unknown>;
  }

  // A freshly exchanged magic-link session can be available before its claims
  // lookup succeeds. Validate the user with Supabase instead of showing the
  // signed-out UI for a valid session.
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) return null;
  return {
    ...userData.user,
    sub: userData.user.id,
    email: userData.user.email ?? "",
    app_metadata: userData.user.app_metadata ?? {},
    user_metadata: userData.user.user_metadata ?? {},
  };
}

export function isAdminClaims(claims: Record<string, unknown> | null) {
  if (!claims) return false;
  const appMetadata = claims.app_metadata as Record<string, unknown> | undefined;
  if (appMetadata?.role === "admin") return true;
  const email = typeof claims.email === "string" ? claims.email.toLowerCase() : "";
  const allowed = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return Boolean(email && allowed.includes(email));
}

export async function requireAdminAccess() {
  const claims = await getAuthClaims();
  if (!claims) return Response.json({ error: "Sign in is required." }, { status: 401 });
  if (!isAdminClaims(claims)) return Response.json({ error: "Admin access is required." }, { status: 403 });
  return null;
}
