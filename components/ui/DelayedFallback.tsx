"use client";

import { useState, useEffect, type ReactNode } from "react";

/** Only renders children after a delay. Prevents skeleton flash on fast navigations. */
export function DelayedFallback({
  children,
  delay = 200,
}: {
  children: ReactNode;
  delay?: number;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShow(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  if (!show) return null;
  return <>{children}</>;
}
