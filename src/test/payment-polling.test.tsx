import { act, render, screen } from "@testing-library/react";
import { ApiProblemError, StorefrontTransportError } from "@oripa/storefront-client";
import { vi } from "vitest";
import { PAYMENT_POLLING_POLICY, usePaymentPolling } from "@/components/payment/use-payment-polling";
import type { Payment, PaymentClientAdapter } from "@/lib/platform";
import { PendingPaymentStatus } from "@/components/payment/pending-payment-status";
import { PaymentClientProvider } from "@/components/payment/payment-client-provider";
import { beginPaymentAttempt, finishPaymentAttempt, readPaymentAttempt, PAYMENT_STATUS_CHECK_EVENT } from "@/components/payment/payment-attempt";
import type { PaymentUiGateway } from "@/lib/platform/payment-ui-gateway";

const metadata = { idempotency_replayed: false, status: 200 } as const;

function payment(status: Payment["status"], method: Payment["method"] = "credit_card"): Payment {
  return {
    amount: { amount: 1_000, currency: "JPY" },
    created_at: "2026-08-26T00:00:00Z",
    expires_at: null,
    grant: { bonus_points: 0, limited_bonus_points: 0, paid_points: 1_000, total_points: 1_000 },
    id: "payment-poll-public-reference",
    method,
    next_action: null,
    point_product_id: "product-public-reference",
    status,
    succeeded_at: status === "succeeded" ? "2026-08-26T00:00:01Z" : null,
  };
}

function client(getPayment: PaymentClientAdapter["getPayment"]): PaymentClientAdapter {
  return { getPayment } as PaymentClientAdapter;
}

function Harness({ adapter, pid = "payment-poll-public-reference" }: { readonly adapter: PaymentClientAdapter; readonly pid?: string | null }) {
  const state = usePaymentPolling(adapter, pid);
  return <output data-state={state.status}>{state.status === "ready" || state.status === "delayed" ? state.payment.status : state.status}</output>;
}

async function flush() {
  await act(async () => { await Promise.resolve(); });
}

describe("SITE-040 Payment polling", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-26T00:00:00Z"));
  });

  afterEach(() => vi.useRealTimers());

  it("performs the initial GET immediately, polls at two seconds, and stops on terminal", async () => {
    const getPayment = vi.fn()
      .mockResolvedValueOnce({ data: payment("created"), metadata })
      .mockResolvedValueOnce({ data: payment("succeeded"), metadata });
    render(<Harness adapter={client(getPayment)} />);
    await flush();
    expect(getPayment).toHaveBeenCalledOnce();
    expect(screen.getByText("created")).toHaveAttribute("data-state", "ready");
    await act(async () => { await vi.advanceTimersByTimeAsync(PAYMENT_POLLING_POLICY.intervalMs - 1); });
    expect(getPayment).toHaveBeenCalledOnce();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(getPayment).toHaveBeenCalledTimes(2);
    expect(screen.getByText("succeeded")).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    expect(getPayment).toHaveBeenCalledTimes(2);
  });

  it.each(["failed", "canceled", "expired"] as const)("stops immediately for %s", async (status) => {
    const getPayment = vi.fn().mockResolvedValue({ data: payment(status), metadata });
    render(<Harness adapter={client(getPayment)} />);
    await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(getPayment).toHaveBeenCalledOnce();
    expect(screen.getByText(status)).toBeInTheDocument();
  });

  it("stops automatically at 30 seconds and never resumes", async () => {
    const getPayment = vi.fn().mockResolvedValue({ data: payment("processing"), metadata });
    render(<Harness adapter={client(getPayment)} />);
    await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(PAYMENT_POLLING_POLICY.maximumWaitMs); });
    expect(screen.getByText("processing")).toHaveAttribute("data-state", "delayed");
    const callsAtStop = getPayment.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(getPayment).toHaveBeenCalledTimes(callsAtStop);
  });

  it("honors canonical 429 retry_after_seconds before the normal interval", async () => {
    const rateLimit = new ApiProblemError({
      code: "RATE_LIMITED",
      detail: "fixture",
      request_id: "request-public-reference",
      retry_after_seconds: 5,
      retryable: true,
      status: 429,
      title: "Too Many Requests",
      type: "about:blank",
    });
    const getPayment = vi.fn()
      .mockRejectedValueOnce(rateLimit)
      .mockResolvedValueOnce({ data: payment("succeeded"), metadata });
    render(<Harness adapter={client(getPayment)} />);
    await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(4_999); });
    expect(getPayment).toHaveBeenCalledOnce();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(getPayment).toHaveBeenCalledTimes(2);
  });

  it("honors Retry-After transport metadata without adding a second retry loop", async () => {
    const rateLimit = new StorefrontTransportError("HTTP_ERROR", "fixture 429", {
      metadata: { idempotency_replayed: false, retry_after_seconds: 4, status: 429 },
    });
    const getPayment = vi.fn()
      .mockRejectedValueOnce(rateLimit)
      .mockResolvedValueOnce({ data: payment("succeeded"), metadata });
    render(<Harness adapter={client(getPayment)} />);
    await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(3_999); });
    expect(getPayment).toHaveBeenCalledOnce();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(getPayment).toHaveBeenCalledTimes(2);
  });

  it("does not poll Konbini or Virtual Account automatically", async () => {
    for (const method of ["konbini", "virtual_account"] as const) {
      const getPayment = vi.fn().mockResolvedValue({ data: payment("created", method), metadata });
      const view = render(<Harness adapter={client(getPayment)} />);
      await flush();
      await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
      expect(getPayment).toHaveBeenCalledOnce();
      view.unmount();
    }
  });

  it.each(["netridecash", "paidy"])("polls Source-only %s fixture until Backend confirms or 30 seconds elapse", async method => {
    // Provisional UI fixture; not a claim that alpha.46 declares this method.
    const getPayment = vi.fn().mockResolvedValue({ data: { ...payment("processing"), method }, metadata });
    render(<Harness adapter={client(getPayment)} />);
    await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(getPayment).toHaveBeenCalledTimes(2);
    await act(async () => { await vi.advanceTimersByTimeAsync(28_000); });
    expect(screen.getByText("processing")).toHaveAttribute("data-state", "delayed");
  });

  it("cancels scheduled work on unmount", async () => {
    const getPayment = vi.fn().mockResolvedValue({ data: payment("processing"), metadata });
    const view = render(<Harness adapter={client(getPayment)} />);
    await flush();
    view.unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(getPayment).toHaveBeenCalledOnce();
  });
});

describe("UnivaPay existing payment success navigation", () => {
  const replace = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers(); const attempt = readPaymentAttempt("member"); if (attempt) finishPaymentAttempt("member", attempt.idempotencyKey); replace.mockReset();
    const browser = window;
    vi.stubGlobal("window", new Proxy(browser, { get(target, key) {
      return key === "location" ? { replace } : Reflect.get(target, key);
    } }));
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });
  function mount(getPayment = vi.fn().mockResolvedValue({ data: payment("requires_action"), metadata }), restore = true) {
    if (restore) beginPaymentAttempt("member", { productId: "product-public-reference", paymentId: "payment-poll-public-reference", idempotencyKey: "existing-key" });
    const adapter = client(getPayment);
    const gateway = { getPayment } as unknown as PaymentUiGateway;
    const view = render(<PaymentClientProvider client={adapter} uiGateway={gateway}><PendingPaymentStatus subject="member" productId="product-public-reference" /></PaymentClientProvider>);
    return { view, getPayment };
  }
  it("starts a bounded observer after submit notification, then navigates once only on Platform success", async () => {
    const s = mount(undefined, false); await flush();
    expect(s.getPayment).not.toHaveBeenCalled();
    beginPaymentAttempt("member", { productId: "product-public-reference", paymentId: "payment-poll-public-reference", idempotencyKey: "existing-key" });
    await act(async () => window.dispatchEvent(new Event(PAYMENT_STATUS_CHECK_EVENT)));
    expect(replace).not.toHaveBeenCalled();
    s.getPayment.mockResolvedValue({ data: payment("succeeded"), metadata });
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(replace).toHaveBeenCalledExactlyOnceWith("/points/purchase/thanks?pid=payment-poll-public-reference");
    expect(readPaymentAttempt("member")?.paymentId).toBe("payment-poll-public-reference");
  });
  it.each(["requires_action", "processing", "failed", "canceled", "expired"] as const)("restores %s without success navigation or a replacement purchase", async status => {
    const s = mount(vi.fn().mockResolvedValue({ data: payment(status), metadata })); await flush();
    await act(async () => { await vi.advanceTimersByTimeAsync(90_000); });
    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole("link")).toHaveAttribute("href", "/points/purchase/thanks?pid=payment-poll-public-reference");
    const count = s.getPayment.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(s.getPayment).toHaveBeenCalledTimes(count);
  });
  it("restores an already succeeded payment after reload", async () => {
    mount(vi.fn().mockResolvedValue({ data: payment("succeeded"), metadata })); await flush();
    expect(replace).toHaveBeenCalledOnce();
  });
  it("retains correlation and link on a read error", async () => {
    mount(vi.fn().mockRejectedValue(new Error("offline"))); await flush();
    expect(replace).not.toHaveBeenCalled(); expect(readPaymentAttempt("member")).not.toBeNull();
    expect(screen.getByRole("link")).toBeInTheDocument();
  });
  it.each(["paidy", "netridecash", "mismatched"])("never redirects %s from the UnivaPay observer", async kind => {
    const data = kind === "mismatched" ? { ...payment("succeeded"), id: "other-payment" } : { ...payment("succeeded"), method: kind };
    mount(vi.fn().mockResolvedValue({ data, metadata })); await flush();
    expect(replace).not.toHaveBeenCalled();
  });
});
