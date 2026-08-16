import { NextResponse } from "next/server";
import { createSupabaseAuthServerClient, isAdminClaims } from "@/lib/supabase-auth-server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const requested = requestUrl.searchParams.get("next") ?? "/";
  const safeNext = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";
  if (code) {
    const supabase = await createSupabaseAuthServerClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const { data: claimsData } = await supabase.auth.getClaims();
        const admin = isAdminClaims(claimsData?.claims ?? null);
        const next = admin ? "/admin" : safeNext.startsWith("/admin") ? "/" : safeNext;
        const forwardedHost = request.headers.get("x-forwarded-host");
        const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
        if (process.env.NODE_ENV !== "development" && forwardedHost) {
          return NextResponse.redirect(`${forwardedProto}://${forwardedHost}${next}`);
        }
        return NextResponse.redirect(`${requestUrl.origin}${next}`);
      }
    }
  }
  return NextResponse.redirect(`${requestUrl.origin}/login?error=callback`);
}
