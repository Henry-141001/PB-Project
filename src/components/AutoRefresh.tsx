"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-fetches the page data every few seconds while it's on screen, so scores update live. */
export function AutoRefresh({ seconds = 4 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return null;
}
