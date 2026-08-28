"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

type AdminIconName = "dashboard" | "storefront" | "products" | "trending" | "pos" | "banners" | "orders" | "sales" | "analytics";

const navigation = [
  { href: "/admin", label: "Dashboard", icon: "dashboard" },
  { href: "/admin/storefront", label: "Storefront", icon: "storefront" },
  { href: "/admin/products", label: "Products", icon: "products" },
  { href: "/admin/trending", label: "Trending", icon: "trending" },
  { href: "/admin/in-person-sale", label: "In-person sale", icon: "pos" },
  { href: "/admin/banners", label: "Banners", icon: "banners" },
  { href: "/admin/orders", label: "Orders", icon: "orders" },
  { href: "/admin/sales", label: "Sales", icon: "sales" },
  { href: "/admin/analytics", label: "Analytics", icon: "analytics" },
] satisfies { href: string; label: string; icon: AdminIconName }[];

function AdminIcon({ name }: { name: AdminIconName }) {
  const paths: Record<AdminIconName, ReactNode> = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    storefront: <><path d="M4 10h16l-2-6H6l-2 6Z" /><path d="M5 10v10h14V10M9 20v-6h6v6" /><path d="M4 10a3 3 0 0 0 5 2 3 3 0 0 0 6 0 3 3 0 0 0 5-2" /></>,
    products: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4.4 7.7 7.6 4.4 7.6-4.4M12 12.1V21" /></>,
    trending: <><path d="M13.5 2.8c.5 3.6-1.7 5.1-3.3 7.1-1.3 1.6-1.7 3.3-.7 5.2.4-1.6 1.5-2.7 2.8-3.8-.1 2.2 1.7 3.2 2.3 4.8.5 1.3.2 3-1 4.2 4.1-.7 6.4-3.5 6.4-7.2 0-4.1-2.8-7.8-6.5-10.3Z" /><path d="M9.5 15.1c-2.2.8-3.7 2.6-3.7 4.7" /></>,
    pos: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h3M15 15h2" /></>,
    banners: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><path d="m3 15 4.7-4.7 4 4 2.7-2.7L21 18M16.5 8h.01" /></>,
    orders: <><path d="M7 4h10l1 17H6L7 4Z" /><path d="M9 7V5a3 3 0 0 1 6 0v2" /></>,
    sales: <path d="M4 19V9M10 19V5M16 19v-7M22 19V3" />,
    analytics: <><path d="M4 19V9M10 19v-5M16 19V5M22 19V2" /><path d="m4 6 6 3 6-6 6 2" /></>,
  };
  return <svg className="admin-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => setMenuOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [menuOpen]);

  return (
    <div className="admin-app-shell">
      <button type="button" className={`admin-mobile-menu-toggle ${menuOpen ? "is-open" : ""}`} aria-label={menuOpen ? "Close admin menu" : "Open admin menu"} aria-expanded={menuOpen} aria-controls="admin-navigation" onClick={() => setMenuOpen((open) => !open)}><i /><i /><i /></button>
      <button type="button" className={`admin-mobile-menu-backdrop ${menuOpen ? "is-open" : ""}`} aria-label="Close admin menu" tabIndex={menuOpen ? 0 : -1} onClick={() => setMenuOpen(false)} />
      <aside className={`admin-sidebar ${menuOpen ? "is-mobile-open" : ""}`} id="admin-navigation">
        <Link className="admin-sidebar-brand" href="/admin" aria-label="Codart admin dashboard">
          <Image className="admin-brand-logo" src="/codart-logo.png" alt="Codart" width={512} height={512} priority />
        </Link>
        <p className="admin-nav-label">Workspace</p>
        <nav aria-label="Admin sections">
          {navigation.map((item) => {
            const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
            return <Link key={item.href} href={item.href} className={active ? "is-active" : ""} aria-current={active ? "page" : undefined} title={item.label} onClick={() => setMenuOpen(false)}><AdminIcon name={item.icon} /><span>{item.label}</span></Link>;
          })}
        </nav>
        <div className="admin-sidebar-footer"><span className="admin-store-status"><i />Store online</span><Link href="/"><span>Open storefront</span><b aria-hidden="true">↗</b></Link></div>
      </aside>
      <div className="admin-page-frame">{children}</div>
    </div>
  );
}
