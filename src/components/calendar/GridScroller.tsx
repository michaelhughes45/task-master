"use client";

import { useLayoutEffect, useRef } from "react";

interface GridScrollerProps {
  // Pixels to scroll down to when the view or range changes.
  scrollTop: number;
  // Changes with the view and range, so moving to another week scrolls again.
  resetKey: string;
  className?: string;
  children: React.ReactNode;
}

// The time grid's scroll container. The grid itself is server-rendered as children.
export function GridScroller({ scrollTop, resetKey, className, children }: GridScrollerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = scrollTop;
  }, [scrollTop, resetKey]);

  return (
    <div ref={ref} role="region" aria-label="Calendar grid" tabIndex={0} className={className}>
      {children}
    </div>
  );
}
