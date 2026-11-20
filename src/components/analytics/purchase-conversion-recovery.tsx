"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { useSession } from "@/components/auth/session-provider";
import { createBrowserPaymentClient } from "@/lib/platform";
import { gtmContainerId } from "@/lib/analytics/gtm";
import { recoverPurchases } from "@/lib/analytics/purchase-recovery";

export function PurchaseConversionRecovery() {
  const pathname = usePathname();
  const { state } = useSession();
  const current = useRef(state);
  const execution = useRef<{ userId: string; active: boolean } | null>(null);
  // The async execution checks the latest committed session before every boundary.
  useEffect(() => {
    current.current = state;
    if (execution.current && (state.status !== "authenticated" || state.session.user?.id !== execution.current.userId)) execution.current.active = false;
  }, [state]);
  const started = useRef(false);
  useEffect(() => {
    if (started.current || pathname === "/points/purchase/thanks" || state.status !== "authenticated" || !gtmContainerId()) return;
    const userId = state.session.user?.id;
    if (!userId) return;
    started.current = true;
    const run = { userId, active: true };
    execution.current = run;
    const isActive = () => run.active && current.current.status === "authenticated" && current.current.session.user?.id === userId;
    try { void recoverPurchases(createBrowserPaymentClient(), userId, state.session.user?.email, isActive); }
    catch { /* Configuration/analytics failures have no UI effect. */ }
  }, [pathname, state]);
  return null;
}
