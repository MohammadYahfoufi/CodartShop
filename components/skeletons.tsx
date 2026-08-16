export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="product-grid" aria-label="Loading products" role="status" aria-live="polite">
      <span className="sr-only">Loading products…</span>
      {Array.from({ length: count }, (_, index) => (
        <div className="product-card skeleton-card" key={index}>
          <div className="skeleton skeleton-image" />
          <div className="product-card-body">
            <div className="skeleton skeleton-line skeleton-title" />
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line skeleton-short" />
            <div className="skeleton skeleton-line skeleton-price" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function StoreLoading() {
  return (
    <div className="loading-page" aria-busy="true">
      <div className="route-progress" aria-hidden="true" />
      <header className="loading-header">
        <strong>CODART</strong>
        <span>Loading shop…</span>
      </header>
      <main className="loading-shell">
        <div className="skeleton loading-kicker" />
        <div className="skeleton loading-heading" />
        <div className="skeleton loading-copy" />
        <ProductGridSkeleton />
      </main>
    </div>
  );
}

export function AdminSkeleton() {
  return (
    <main className="admin-shell">
      <div className="skeleton admin-title-skeleton" />
      <div className="admin-layout">
        <div className="admin-form-panel skeleton admin-panel-skeleton" />
        <div className="admin-list-panel skeleton admin-panel-skeleton" />
      </div>
    </main>
  );
}
