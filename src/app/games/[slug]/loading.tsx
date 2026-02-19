export default function GameLoading() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8" role="status" aria-label="Loading game page">
      {/* Breadcrumb skeleton */}
      <nav className="flex items-center gap-2 mb-5">
        <div className="animate-skeleton-pulse bg-white/5 rounded h-4 w-12" />
        <div className="animate-skeleton-pulse bg-white/5 rounded h-4 w-3" />
        <div className="animate-skeleton-pulse bg-white/5 rounded h-4 w-16" />
        <div className="animate-skeleton-pulse bg-white/5 rounded h-4 w-3" />
        <div className="animate-skeleton-pulse bg-white/5 rounded h-4 w-24" />
      </nav>

      {/* Game player skeleton */}
      <div className="w-full space-y-3">
        <div className="animate-skeleton-pulse bg-white/5 rounded-xl h-[400px] w-full" />
      </div>

      {/* Game info skeleton */}
      <div className="bg-card border border-white/[0.06] rounded-xl p-6 mt-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            <div className="flex items-center gap-3">
              <div className="animate-skeleton-pulse bg-white/5 rounded h-7 w-48" />
              <div className="animate-skeleton-pulse bg-white/5 rounded-full h-6 w-16" />
            </div>
            <div className="animate-skeleton-pulse bg-white/5 rounded h-4 w-full max-w-md" />
            <div className="animate-skeleton-pulse bg-white/5 rounded h-4 w-full max-w-sm" />
          </div>
          <div className="flex items-center gap-2">
            <div className="animate-skeleton-pulse bg-white/5 rounded-full h-9 w-16" />
            <div className="animate-skeleton-pulse bg-white/5 rounded-full h-9 w-16" />
          </div>
        </div>
        <div className="animate-skeleton-pulse bg-white/5 rounded h-4 w-64" />
      </div>

      {/* Related games skeleton */}
      <div className="mt-10 space-y-4">
        <div className="animate-skeleton-pulse bg-white/5 rounded h-6 w-36" />
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-skeleton-pulse bg-white/5 rounded-xl h-40" />
          ))}
        </div>
      </div>

      <span className="sr-only">Loading game...</span>
    </div>
  );
}
