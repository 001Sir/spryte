import Link from 'next/link';
import Image from 'next/image';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        {/* Logo */}
        <div className="mb-8 inline-block opacity-40">
          <Image
            src="/logo.png"
            alt=""
            width={80}
            height={80}
            className="rounded-full"
            aria-hidden="true"
          />
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
