import { getAuthClaims, isAdminClaims } from "@/lib/supabase-auth-server";

export const dynamic = "force-dynamic";

export async function GET() {
  const claims = await getAuthClaims();
  if (!claims) return Response.json({ user: null }, { headers: { "Cache-Control": "no-store" } });
  const metadata = (claims.user_metadata ?? {}) as Record<string, unknown>;
  const email = typeof claims.email === "string" ? claims.email : "";
  const name = typeof metadata.full_name === "string" ? metadata.full_name : typeof metadata.name === "string" ? metadata.name : email.split("@")[0] || "Codart customer";
  const avatar = typeof metadata.avatar_url === "string" && metadata.avatar_url.startsWith("https://") ? metadata.avatar_url : "";
  return Response.json({ user: { id: claims.sub, email, name, avatar, admin: isAdminClaims(claims) } }, { headers: { "Cache-Control": "no-store" } });
}
