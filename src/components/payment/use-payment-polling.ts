"use client";

import { useEffect, useRef, useState } from "react";
import {
  isInvalidPaymentRead,
  paymentRetryAfterSeconds,
  type Payment,
  type PaymentClientAdapter,
} from "@/lib/platform";

const POLLING_INTERVAL_MS = 2_000;
const MAXIMUM_WAIT_MS = 30_000;
const terminalStatuses = new Set(["succeeded", "failed", "canceled", "expired"]);

export type PaymentPollingState = (
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly payment: Payment }
  | { readonly status: "delayed"; readonly payment: Payment }
  | { readonly status: "invalid" }
  | { readonly status: "error" }) & { readonly refreshing?: boolean };

interface CorrelatedPollingResult {
  readonly client: PaymentClientAdapter;
  readonly pid: string;
  readonly state: PaymentPollingState;
  readonly revision: number;
}

function validPid(pid: string | null) {
  return Boolean(pid && pid.length <= 128 && !pid.includes("/") && !pid.includes("\0"));
}

export function usePaymentPolling(client: PaymentClientAdapter | null, pid: string | null, retainOnError = false, revision = 0): PaymentPollingState {
  const [result, setResult] = useState<CorrelatedPollingResult | null>(null);
  const lastVerified = useRef<{ client: PaymentClientAdapter; pid: string; payment: Payment } | null>(null);

  useEffect(() => {
    if (!client || !pid || !validPid(pid)) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let latest: Payment | null = retainOnError && lastVerified.current?.client === client && lastVerified.current.pid === pid ? lastVerified.current.payment : null;
    const startedAt = Date.now();
    const publish = (state: PaymentPollingState) => setResult({ client, pid, state, revision });

    const stopDelayed = () => {
      if (!active) return;
      if (latest) publish({ payment: latest, status: "delayed" });
      else publish({ status: "error" });
    };

    const schedule = (delayMs: number) => {
      const remaining = MAXIMUM_WAIT_MS - (Date.now() - startedAt);
      if (remaining <= 0) {
        stopDelayed();
        return;
      }
      if (delayMs > remaining) {
        timer = setTimeout(stopDelayed, remaining);
        return;
      }
      timer = setTimeout(() => { void read(); }, delayMs);
    };

    const read = async () => {
      try {
        const { data: payment } = await client.getPayment(pid);
        if (!active) return;
        if (payment.id !== pid) { lastVerified.current = null; publish({ status: "invalid" }); return; }
        latest = payment;
        lastVerified.current = { client, pid, payment };
        publish({ payment, status: "ready" });
        if (terminalStatuses.has(payment.status)) return;
        if (payment.method === "konbini" || payment.method === "virtual_account") return;
        schedule(POLLING_INTERVAL_MS);
      } catch (error) {
        if (!active) return;
        if (isInvalidPaymentRead(error)) {
          lastVerified.current = null;
          publish({ status: "invalid" });
          return;
        }
        const retryAfter = paymentRetryAfterSeconds(error);
        if (retryAfter !== undefined) {
          schedule(Math.max(POLLING_INTERVAL_MS, retryAfter * 1_000));
          return;
        }
        if (retainOnError && latest) publish({ status: "delayed", payment: latest });
        else publish({ status: "error" });
      }
    };

    void read();
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [client, pid, retainOnError, revision]);

  if (!client || !pid || !validPid(pid)) return { status: "invalid" };
  if (!result || result.client !== client || result.pid !== pid) return { status: "loading" };
  if (result.revision !== revision) return retainOnError && (result.state.status === "ready" || result.state.status === "delayed") ? { ...result.state, refreshing: true } : { status: "loading" };
  return result.state;
}

export const PAYMENT_POLLING_POLICY = {
  intervalMs: POLLING_INTERVAL_MS,
  maximumWaitMs: MAXIMUM_WAIT_MS,
} as const;
