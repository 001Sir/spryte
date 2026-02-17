'use client';

import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* Warning icon */}
        <div className="mb-8 inline-block">
          <svg
            width="80"
            height="80"
            viewBox="0 0 80 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle cx="40" cy="40" r="36" fill="#14141f" stroke="#2a2a3e" strokeWidth="2" />
            <path
              d="M40 24v20"
              stroke="#e94560"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="40" cy="52" r="2.5" fill="#e94560" />
          </svg>
        </div>

        <h1 className="text-4xl font-black mb-3">
          <span className="bg-gradient-to-r from-accent to-[#ff7eb3] bg-clip-text text-transparent">
            Oops!
          </span>
        </h1>
        <h2 className="text-xl font-semibold text-foreground mb-3">
          Something went wrong
        </h2>
        <p className="text-muted mb-8">
          An unexpected error occurred. You can try again or head back to the
          home page.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="inline-flex items-center justify-center gap-2 bg-accent hover:bg-accent-hover text-white px-6 py-3 rounded-xl font-semibold transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M1 4v6h6" />
              <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
            </svg>
            Try Again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 border border-border hover:border-accent/50 text-foreground px-6 py-3 rounded-xl font-semibold transition-colors"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h3a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h3a1 1 0 001-1V10" />
            </svg>
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
