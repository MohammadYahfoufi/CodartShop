import type { Metadata } from "next";
import "./globals.css";
import "./admin-enhancements.css";
import { AnalyticsTracker } from "@/components/analytics-tracker";
import { getStorefrontSettings } from "@/lib/storefront-settings";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStorefrontSettings();
  return {
    title: { default: settings.seo_title, template: `%s — ${settings.site_name}` },
    description: settings.seo_description,
    icons: {
      icon: [{ url: "/logo small.jpg?v=1", type: "image/jpeg" }],
      shortcut: "/logo small.jpg?v=1",
      apple: "/logo small.jpg?v=1",
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body className="min-h-full"><AnalyticsTracker />{children}</body>
    </html>
  );
}
