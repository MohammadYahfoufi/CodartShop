import type { Metadata } from "next";
import { BannerManager } from "@/components/banner-manager";
import { getHeroSlides } from "@/lib/slides";

export const metadata: Metadata = { title: "Homepage banners" };
export const dynamic = "force-dynamic";

export default async function BannersAdminPage() {
  return <main className="admin-workspace"><header className="admin-page-heading"><div><p className="eyebrow">Homepage editor</p><h1>Banners</h1><p>Choose the images and messages shown in the storefront slideshow.</p></div></header><BannerManager initialSlides={await getHeroSlides(true)} /></main>;
}
