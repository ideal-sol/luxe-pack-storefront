"use client";

import { useEffect, useRef, useState } from "react";
import { isTransientPaymentRead } from "@/lib/platform/payment-problem";
import {
  isInvalidPaymentRead,
  paymentRetryAfterSeconds,
  type Payment,
  type PaymentClientAdapter,
} from "@/lib/platform";

export const PAYMENT_POLLING_POLICY = {
  initialIntervalMs: 2_000,
  extendedIntervalMs: 5_000,
  extendAfterMs: 30_000,
  maximumWaitMs: 300_000,
} as const;
const terminalStatuses = new Set(["succeeded", "failed", "canceled", "expired"]);

export type PaymentPollingState = (
  | { readonly status: "loading" }
  | { readonly status: "ready"; readonly payment: Payment }
  | { readonly status: "delayed"; readonly payment: Payment }
  | { readonly status: "invalid" }
  | { readonly status: "error" }) & { readonly refreshing?: boolean; readonly extended?: boolean };

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
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let expired = false;
    let latest: Payment | null = retainOnError && lastVerified.current?.client === client && lastVerified.current.pid === pid && lastVerified.current.payment.method === "credit_card" ? lastVerified.current.payment : null;
    const startedAt = Date.now();
    const elapsed = () => Date.now() - startedAt;
    const publish = (state: PaymentPollingState) => setResult({ client, pid, state, revision });
    const clearTimers = () => { clearTimeout(timer); clearTimeout(extension); clearTimeout(deadline); };
    const stop = (state: PaymentPollingState) => { stopped = true; clearTimers(); publish(state); };

    const stopDelayed = () => {
      if (!active || stopped) return;
      expired = true;
      clearTimers();
      if (latest) publish({ payment: latest, status: "delayed" });
      else publish({ status: "error" });
    };

    const schedule = (retryAfter = 0) => {
      if (stopped || expired) return;
      const interval = elapsed() < PAYMENT_POLLING_POLICY.extendAfterMs ? PAYMENT_POLLING_POLICY.initialIntervalMs : PAYMENT_POLLING_POLICY.extendedIntervalMs;
      const delayMs = Math.max(interval, retryAfter * 1_000);
      if (elapsed() + delayMs >= PAYMENT_POLLING_POLICY.maximumWaitMs) return;
      timer = setTimeout(() => { void read(); }, delayMs);
    };

    const read = async () => {
      if (!active || stopped || expired || elapsed() >= PAYMENT_POLLING_POLICY.maximumWaitMs) return;
      try {
        const { data: payment } = await client.getPayment(pid);
        if (!active || stopped) return;
        if (payment.id !== pid) { lastVerified.current = null; stop({ status: "invalid" }); return; }
        if (expired && payment.status !== "succeeded") return;
        latest = payment;
        lastVerified.current = { client, pid, payment };
        const state: PaymentPollingState = { payment, status: "ready", extended: elapsed() >= PAYMENT_POLLING_POLICY.extendAfterMs };
        if (terminalStatuses.has(payment.status) || payment.method === "konbini" || payment.method === "virtual_account") { stop(state); return; }
        publish(state);
        schedule();
      } catch (error) {
        if (!active || stopped || expired) return;
        if (isInvalidPaymentRead(error)) {
          lastVerified.current = null;
          stop({ status: "invalid" });
          return;
        }
        const retryAfter = paymentRetryAfterSeconds(error);
        if (retryAfter !== undefined) {
          schedule(retryAfter);
          return;
        }
        if (isTransientPaymentRead(error)) { schedule(); return; }
        stop(retainOnError && latest?.method === "credit_card" ? { status: "delayed", payment: latest } : { status: "error" });
      }
    };

    const extension = setTimeout(() => {
      if (active && !stopped && !expired) publish(latest ? { status: "ready", payment: latest, extended: true } : { status: "loading", extended: true });
    }, PAYMENT_POLLING_POLICY.extendAfterMs);
    const deadline = setTimeout(stopDelayed, PAYMENT_POLLING_POLICY.maximumWaitMs);
    void read();
    return () => {
      active = false;
      clearTimers();
    };
  }, [client, pid, retainOnError, revision]);

  if (!client || !pid || !validPid(pid)) return { status: "invalid" };
  if (!result || result.client !== client || result.pid !== pid) return { status: "loading" };
  if (result.revision !== revision) return retainOnError && (result.state.status === "ready" || result.state.status === "delayed") ? { ...result.state, refreshing: true } : { status: "loading" };
  return result.state;
}
