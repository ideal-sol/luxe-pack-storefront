"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { advertisingLastClick } from "@/lib/platform/advertising-client";

export function AdvertisingCapture() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    void advertisingLastClick.capture(search);
  }, [pathname, search]);
  return null;
}
