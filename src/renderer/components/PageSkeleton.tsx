export default function PageSkeleton({ page }: { page: string }) {
  return (
    <section
      className={`page-skeleton page-skeleton-${page}`}
      role="status"
      aria-label="正在加载页面"
      aria-busy="true"
    >
      <span className="muted">正在准备页面…</span>
      <div className="skeleton-line" />
      <div className="skeleton-grid" aria-hidden="true">
        {Array.from({ length: page === "calendar" ? 35 : 6 }, (_, i) => (
          <div className="skeleton-tile" key={i} />
        ))}
      </div>
    </section>
  );
}
