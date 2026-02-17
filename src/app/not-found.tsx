import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* Ghost icon */}
        <div className="animate-ghost-float mb-8 inline-block">
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M40 8C23.4 8 10 21.4 10 38v28c0 2 1.6 3.2 3.2 2.4L20 64l6.8 4.4c1.2.8 2.8.8 4 0L40 62l9.2 6.4c1.2.8 2.8.8 4 0L60 64l6.8 4.4c1.6.8 3.2-.4 3.2-2.4V38C70 21.4 56.6 8 40 8z"
              fill="#1c1c2e"
              stroke="#2a2a3e"
              strokeWidth="2"
            />
            <circle cx="30" cy="36" r="4" fill="#e94560" />
            <circle cx="50" cy="36" r="4" fill="#e94560" />
            <path
              d="M32 48c0 0 4 4 8 4s8-4 8-4"
              stroke="#e94560"
              strokeWidth="2"
              strokeLinecap="round"
              fill="none"
            />
          </svg>
        </div>

        <h1 className="text-6xl font-black mb-3">
          <span className="bg-gradient-to-r from-accent to-[#ff7eb3] bg-clip-text text-transparent">
            404
          </span>
        </h1>
        <h2 className="text-xl font-semibold text-foreground mb-3">Page Not Found</h2>
        <p className="text-muted mb-8">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white px-6 py-3 rounded-xl font-semibold transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10" />
            </svg>
            Back to Home
          </Link>
          <Link
            href="/search"
            className="inline-flex items-center justify-center gap-2 border border-border hover:border-accent/50 text-foreground px-6 py-3 rounded-xl font-semibold transition-colors"
          >
            Search Games
          </Link>
        </div>
      </div>
    </div>
  );
}
