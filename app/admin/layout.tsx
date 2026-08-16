import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin-shell";
import { getAuthClaims, isAdminClaims } from "@/lib/supabase-auth-server";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const claims = await getAuthClaims();
  if (!claims) redirect("/login?next=/admin");
  if (!isAdminClaims(claims)) redirect("/account?admin=denied");
  return <AdminShell>{children}</AdminShell>;
}
