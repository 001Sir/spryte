'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useState, ReactNode } from 'react';

export default function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [displayChildren, setDisplayChildren] = useState(children);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    // When pathname changes, fade out then swap content
    setTransitioning(true);
    const timer = setTimeout(() => {
      setDisplayChildren(children);
      setTransitioning(false);
    }, 150);
    return () => clearTimeout(timer);
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps -- trigger on route change only

  // On initial mount or when children update (same route), update immediately
  useEffect(() => {
    if (!transitioning) {
      setDisplayChildren(children);
    }
  }, [children, transitioning]);

  return (
    <div
      className="transition-opacity duration-150 ease-out"
      style={{ opacity: transitioning ? 0 : 1 }}
    >
      {displayChildren}
    </div>
  );
}
