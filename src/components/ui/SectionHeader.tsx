import Link from 'next/link';

interface SectionHeaderProps {
  title: string;
  count?: number;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
}

export default function SectionHeader({
  title,
  count,
  subtitle,
  href,
  linkLabel = 'See all',
}: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-8">
      <div className="flex items-baseline gap-3">
        <div className="flex items-center gap-3">
          <div className="w-1 h-5 rounded-full bg-accent-soft" />
          <h2 className="text-[1.3rem] font-bold tracking-tight font-[family-name:var(--font-display)]">
            {title}
          </h2>
        </div>
        {count !== undefined && (
          <span className="text-[0.7rem] font-semibold px-2 py-0.5 rounded-full bg-accent-soft/10 text-accent-soft">
            {count}
          </span>
        )}
        {subtitle && (
          <span className="text-dim text-[0.85rem]">{subtitle}</span>
        )}
      </div>
      {href && (
        <Link
          href={href}
          className="text-[0.8rem] text-accent-soft hover:text-foreground transition-colors font-medium"
        >
          {linkLabel} &rarr;
        </Link>
      )}
    </div>
  );
}
