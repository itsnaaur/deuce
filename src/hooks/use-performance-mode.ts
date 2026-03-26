"use client";

import { useEffect, useState } from "react";

export function usePerformanceMode() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQueries = [
      window.matchMedia("(prefers-reduced-motion: reduce)"),
      window.matchMedia("(pointer: coarse) and (max-width: 1366px)"),
    ];

    const evaluate = () => {
      setReducedMotion(mediaQueries.some((query) => query.matches));
    };

    evaluate();
    for (const query of mediaQueries) {
      query.addEventListener("change", evaluate);
    }

    return () => {
      for (const query of mediaQueries) {
        query.removeEventListener("change", evaluate);
      }
    };
  }, []);

  return { reducedMotion };
}
