import type { Metadata } from "next";
import "./globals.css";
import "./admin-enhancements.css";
import { AnalyticsTracker } from "@/components/analytics-tracker";

export const metadata: Metadata = {
  title: {
    default: "Codart — Future-ready tech",
    template: "%s — Codart",
  },
  description:
    "Curated technology for better work, play, and everything in between.",
  icons: {
    icon: [{ url: "/codart-logo.png?v=3", type: "image/png" }],
    shortcut: "/codart-logo.png?v=3",
    apple: "/codart-logo.png",
  },
};

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
