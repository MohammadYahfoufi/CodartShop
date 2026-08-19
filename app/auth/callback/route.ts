import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseAuthServerClient, isAdminClaims } from "@/lib/supabase-auth-server";

const emailOtpTypes = new Set<EmailOtpType>([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const tokenHash = requestUrl.searchParams.get("token_hash");
  const requestedType = requestUrl.searchParams.get("type") as EmailOtpType | null;
  const requested = requestUrl.searchParams.get("next") ?? "/";
  const safeNext = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";
  const supabase = await createSupabaseAuthServerClient();
  if (supabase) {
    const error = tokenHash && requestedType && emailOtpTypes.has(requestedType)
      ? (await supabase.auth.verifyOtp({ token_hash: tokenHash, type: requestedType })).error
      : code
        ? (await supabase.auth.exchangeCodeForSession(code)).error
        : new Error("The sign-in link is missing its verification token.");
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
    console.warn("Supabase sign-in callback failed:", error.message);
  }
  return NextResponse.redirect(`${requestUrl.origin}/login?error=callback`);
}
