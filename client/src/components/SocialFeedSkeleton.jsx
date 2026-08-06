/** Skeleton placeholders while the comunidad feed loads. */
export default function SocialFeedSkeleton({ count = 4 }) {
  return (
    <div className="space-y-3 sm:space-y-4" aria-busy="true" aria-label="Cargando publicaciones">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="card overflow-hidden p-4 sm:p-5"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <div className="mb-4 flex items-start gap-3">
            <div className="h-12 w-12 shrink-0 animate-pulse rounded-full bg-[color:var(--bg-muted)]" />
            <div className="min-w-0 flex-1 space-y-2 pt-0.5">
              <div className="h-3.5 w-[42%] animate-pulse rounded-full bg-[color:var(--bg-muted)]" />
              <div className="h-3 w-[28%] animate-pulse rounded-full bg-[color:var(--bg-muted)] opacity-70" />
            </div>
          </div>
          <div className="mb-3 space-y-2">
            <div className="h-3 w-full animate-pulse rounded-full bg-[color:var(--bg-muted)]" />
            <div className="h-3 w-[88%] animate-pulse rounded-full bg-[color:var(--bg-muted)]" />
            <div className="h-3 w-[62%] animate-pulse rounded-full bg-[color:var(--bg-muted)] opacity-80" />
          </div>
          <div
            className="mb-4 animate-pulse rounded-xl bg-[color:var(--bg-muted)]"
            style={{ height: i % 2 === 0 ? '11rem' : '8.5rem' }}
          />
          <div className="flex items-center gap-4 border-t border-app pt-3">
            <div className="h-8 w-20 animate-pulse rounded-xl bg-[color:var(--bg-muted)]" />
            <div className="h-8 w-14 animate-pulse rounded-xl bg-[color:var(--bg-muted)]" />
            <div className="ml-auto h-8 w-10 animate-pulse rounded-xl bg-[color:var(--bg-muted)]" />
          </div>
        </div>
      ))}
    </div>
  )
}
