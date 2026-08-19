import Image from "next/image";

export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="product-grid" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <article className="product-card skeleton-card" key={index}>
          <div className="product-media skeleton skeleton-image" />
          <div className="product-card-body">
            <div className="skeleton skeleton-line skeleton-title" />
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line skeleton-short" />
            <div className="skeleton-product-action">
              <div className="skeleton skeleton-price" />
              <div className="skeleton skeleton-button" />
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function StoreLoading({ drawer = false }: { drawer?: boolean }) {
  return (
    <div className="loading-page" aria-busy="true" role="status">
      <span className="sr-only">Loading shop…</span>
      <div className="route-progress" aria-hidden="true" />
      <header className="loading-header">
        <span className="loading-brand">
          <Image src="/codart-logo.png" alt="Codart" width={512} height={512} priority />
        </span>
        <div className="loading-nav" aria-hidden="true">
          <span className="skeleton skeleton-dark" />
          <span className="skeleton skeleton-dark" />
          <span className="skeleton skeleton-dark" />
        </div>
        <div className="loading-actions" aria-hidden="true">
          <span className="skeleton skeleton-dark" />
          <span className="skeleton skeleton-dark" />
          <span className="skeleton skeleton-dark" />
        </div>
      </header>
      <main aria-hidden="true">
        <section className="loading-hero">
          <div className="loading-hero-copy">
            <div className="skeleton skeleton-dark loading-kicker" />
            <div className="skeleton skeleton-dark loading-hero-title" />
            <div className="skeleton skeleton-dark loading-hero-title loading-hero-title-short" />
            <div className="skeleton skeleton-dark loading-copy" />
            <div className="skeleton skeleton-dark loading-copy loading-copy-short" />
            <div className="skeleton skeleton-dark loading-cta" />
          </div>
          <div className="skeleton skeleton-dark loading-hero-art" />
        </section>
        <section className="products-section loading-products-section">
          <div className="loading-section-heading">
            <div>
              <div className="skeleton loading-kicker" />
              <div className="skeleton loading-heading" />
            </div>
            <div className="skeleton loading-search" />
          </div>
          <div className="skeleton loading-status" />
          <ProductGridSkeleton />
        </section>
      </main>
      {drawer && <LoadingDrawer />}
    </div>
  );
}

function LoadingDrawer() {
  return (
    <>
      <div className="drawer-backdrop is-open" aria-hidden="true" />
      <aside className="cart-drawer is-open loading-drawer" aria-hidden="true">
        <div className="drawer-header">
          <div>
            <div className="skeleton loading-kicker" />
            <div className="skeleton loading-drawer-title" />
          </div>
          <div className="skeleton loading-close" />
        </div>
        <div className="loading-drawer-body">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="loading-cart-item" key={index}>
              <div className="skeleton loading-cart-image" />
              <div>
                <div className="skeleton skeleton-line skeleton-title" />
                <div className="skeleton skeleton-line skeleton-short" />
              </div>
            </div>
          ))}
        </div>
        <div className="loading-drawer-footer">
          <div className="skeleton skeleton-line" />
          <div className="skeleton loading-drawer-button" />
        </div>
      </aside>
    </>
  );
}

export function AdminSkeleton() {
  return (
    <main className="admin-shell" aria-busy="true" role="status">
      <span className="sr-only">Loading admin dashboard…</span>
      <div className="skeleton admin-title-skeleton" />
      <div className="admin-layout" aria-hidden="true">
        <div className="admin-form-panel skeleton admin-panel-skeleton" />
        <div className="admin-list-panel skeleton admin-panel-skeleton" />
      </div>
    </main>
  );
}
