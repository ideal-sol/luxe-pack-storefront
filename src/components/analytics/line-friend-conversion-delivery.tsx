"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { useSession } from "@/components/auth/session-provider";
import { createLineFriendConversionRun, type LineFriendConversionApi } from "@/lib/analytics/line-friend-conversion";

const run = createLineFriendConversionRun();

export function LineFriendConversionDelivery({ api }: { api: LineFriendConversionApi }) {
  const { state, smsAccess } = useSession();
  const user = state.status === "authenticated" ? state.session.user : null;
  const attempt = useRef<{ userId: string; active: boolean } | null>(null);

  useLayoutEffect(() => {
    const previous = attempt.current;
    if (previous && (previous.userId !== user?.id || smsAccess !== "verified")) previous.active = false;
  }, [smsAccess, user]);

  useEffect(() => {
    if (!user?.id || smsAccess !== "verified") return;
    const current = attempt.current ?? { userId: user.id, active: true };
    attempt.current = current;
    void run(api, {
      userId: user.id,
      email: user.email ?? null,
      smsVerified: true,
      isActive: () => current.active && current.userId === user.id,
    });
  }, [api, smsAccess, user]);
  return null;
}
