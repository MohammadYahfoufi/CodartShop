import { requireAdminAccess } from "@/lib/supabase-auth-server";
import { getAdminOverview } from "@/lib/orders";

export async function GET() {
  const unauthorized = await requireAdminAccess();
  if (unauthorized) return unauthorized;
  return Response.json({ orders: (await getAdminOverview()).orders }, { headers: { "Cache-Control": "no-store" } });
}
