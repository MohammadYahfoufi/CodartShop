import { ProductGridSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <main className="loading-shell">
      <div className="skeleton loading-kicker" />
      <div className="skeleton loading-heading" />
      <div className="skeleton loading-copy" />
      <ProductGridSkeleton />
    </main>
  );
}
