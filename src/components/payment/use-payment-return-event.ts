"use client";

import { useEffect } from "react";
import { useSession } from "@/components/auth/session-provider";
import { recordUiEvent } from "@/lib/platform/payment-ui-gateway";
import { usePaymentClient } from "./payment-client-provider";

export function usePaymentReturnEvent(pid: string | null) {
  const { uiGateway } = usePaymentClient();
  const { state } = useSession();
  const subject = state.status === "authenticated" ? state.session.user?.id : null;
  useEffect(() => {
    if (!uiGateway || !subject || !pid || pid.length > 128 || /[\s/\\\0]/.test(pid)) return;
    // `returned` is advisory. A URL never supplies a financial result.
    void recordUiEvent(uiGateway, pid, { type: "returned" });
  }, [pid, subject, uiGateway]);
}
