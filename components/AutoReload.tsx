"use client";

import { useEffect } from "react";

/** Reload the page every `seconds`. For a waiting page that should become a redirect on its own. */
export default function AutoReload({ seconds }: { seconds: number }) {
  useEffect(() => {
    const id = setTimeout(() => window.location.reload(), seconds * 1000);
    return () => clearTimeout(id);
  }, [seconds]);
  return null;
}
