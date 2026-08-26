import type { Metadata } from 'next';
import './globals.css';
import './admin-enhancements.css';
import { AnalyticsTracker } from '@/components/analytics-tracker';
import { getStorefrontSettings } from '@/lib/storefront-settings';
import { AssistantHub } from '@/components/assistant-hub';

export const dynamic = 'force-dynamic';

function metadataBase() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) {
    try { return new URL(configured); } catch { /* Use the deployment URL fallback. */ }
  }
  const deploymentHost = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL;
  return new URL(deploymentHost ? `https://${deploymentHost}` : 'http://localhost:3000');
}

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getStorefrontSettings();
  const title = settings.seo_title.replace(/[—–]/g, '-');
  return {
    metadataBase: metadataBase(),
    title: {
      default: title,
      template: `%s - ${settings.site_name}`,
    },
    description: settings.seo_description,
    openGraph: {
      type: 'website',
      locale: 'en_US',
      url: '/',
      siteName: settings.site_name,
      title,
      description: settings.seo_description,
      images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: `${settings.site_name} storefront` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: settings.seo_description,
      images: ['/opengraph-image'],
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
      <body className="min-h-full">
        <AnalyticsTracker />
        {children}
        <AssistantHub />
      </body>
    </html>
  );
}
