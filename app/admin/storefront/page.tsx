import type { Metadata } from "next";
import { StorefrontSettingsEditor } from "@/components/storefront-settings-editor";
import { getStorefrontSettings } from "@/lib/storefront-settings";

export const metadata: Metadata = { title: "Storefront editor" };
export const dynamic = "force-dynamic";

export default async function StorefrontEditorPage() {
  return <main className="admin-workspace"><header className="admin-page-heading"><div><p className="eyebrow">Content management</p><h1>Storefront</h1><p>Edit the important text, branding, and imagery shown to customers.</p></div></header><StorefrontSettingsEditor initialSettings={await getStorefrontSettings()} /></main>;
}
