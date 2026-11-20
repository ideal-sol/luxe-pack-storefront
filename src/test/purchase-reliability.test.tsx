import { act, renderHook } from "@testing-library/react";
import { webcrypto } from "node:crypto";
import { ApiProblemError, StorefrontTransportError } from "@oripa/storefront-client";
import { usePaymentPolling } from "@/components/payment/use-payment-polling";
import { PENDING_PURCHASE_KEY, rememberPurchase, recoverPurchases, updatePendingPurchases } from "@/lib/analytics/purchase-recovery";
import type { Payment, PaymentClientAdapter } from "@/lib/platform";
import { reportPurchaseComplete } from "@/lib/analytics/gtm";

const user = "10000000-0000-4000-8000-000000000001";
let sequence = 0;
const id = () => `20000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;
const payment = (paymentId = id(), status: Payment["status"] = "processing", method: Payment["method"] = "credit_card") => ({ id: paymentId, status, method, amount: { amount: 1000, currency: "JPY" } }) as Payment;
const rows = () => JSON.parse(window.localStorage.getItem(PENDING_PURCHASE_KEY) ?? "[]");
const layer = () => (window as Window & { dataLayer?: unknown[] }).dataLayer;
const active = () => true;
const problem = (status: number, code?: string) => new ApiProblemError({ type: "about:blank", title: "Synthetic", status, request_id: "synthetic", retryable: false, code: code as string });

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_GTM_ID", "GTM-TEST0001"); vi.stubGlobal("crypto", webcrypto);
  window.localStorage.clear(); delete (window as Window & { dataLayer?: unknown[] }).dataLayer;
});
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("purchase reliability deadlines", () => {
  const setup = (getPayment: ReturnType<typeof vi.fn>, pid: string) => {
    const adapter = { getPayment } as unknown as PaymentClientAdapter;
    return renderHook(({ revision }) => usePaymentPolling(adapter, pid, false, revision), { initialProps: { revision: 0 } });
  };
  const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
  it("extends at 30 seconds while GET is pending and accepts correlated late success", async () => {
    vi.useFakeTimers(); const p = payment(); let resolve!: (value: { data: Payment }) => void;
    const get = vi.fn(() => new Promise<{ data: Payment }>(r => { resolve = r; })); const view = setup(get, p.id);
    await advance(30_000); expect(view.result.current).toEqual({ status: "loading", extended: true });
    await advance(270_000); expect(view.result.current.status).toBe("error"); expect(get).toHaveBeenCalledOnce();
    await act(async () => { resolve({ data: { ...p, status: "succeeded" } }); });
    expect(view.result.current.status).toBe("ready"); await advance(600_000); expect(get).toHaveBeenCalledOnce();
  });
  it.each(["processing", "failed"] as const)("ignores late %s and stale executions", async status => {
    vi.useFakeTimers(); const p = payment(); const resolvers: ((v: { data: Payment }) => void)[] = [];
    const get = vi.fn(() => new Promise(r => resolvers.push(r))); const view = setup(get, p.id);
    await advance(300_000); await act(async () => resolvers[0]!({ data: { ...p, status } })); expect(view.result.current.status).toBe("error");
    view.rerender({ revision: 1 }); await advance(0); view.rerender({ revision: 2 });
    await act(async () => resolvers[1]!({ data: { ...p, status: "succeeded" } })); expect(view.result.current.status).toBe("loading");
  });
  it("uses two then five seconds, and never sends a GET at the deadline", async () => {
    vi.useFakeTimers(); const p = payment(); const times: number[] = []; const start = Date.now();
    const get = vi.fn(async () => { times.push(Date.now() - start); return { data: p }; }); const view = setup(get, p.id);
    await advance(30_000); expect(view.result.current.extended).toBe(true); expect(times.slice(-2)).toEqual([28_000, 30_000]);
    await advance(5_000); expect(times.at(-1)).toBe(35_000); await advance(265_000);
    expect(view.result.current.status).toBe("delayed"); expect(times.at(-1)).toBe(295_000); expect(times).not.toContain(300_000);
  });
  it.each(["konbini", "virtual_account", "succeeded", "invalid"])("clears every timer after %s", async mode => {
    vi.useFakeTimers(); const p = payment(); const get = vi.fn(async () => ({ data: mode === "invalid" ? { ...p, id: "wrong" } : mode === "succeeded" ? { ...p, status: "succeeded" } : { ...p, method: mode } }));
    const view = setup(get, p.id); await advance(0); const before = view.result.current; await advance(600_000);
    expect(view.result.current).toEqual(before); expect(get).toHaveBeenCalledOnce();
  });
  it("retries transport and 5xx while preserving the deadline", async () => {
    vi.useFakeTimers(); const p = payment(); const get = vi.fn().mockRejectedValueOnce(new StorefrontTransportError("TIMEOUT", "synthetic")).mockRejectedValueOnce(problem(503)).mockResolvedValue({ data: { ...p, status: "succeeded" } });
    const view = setup(get, p.id); await advance(4_000); expect(get).toHaveBeenCalledTimes(3); expect(view.result.current.status).toBe("ready");
  });
  it("honors Retry-After received at 25 seconds and refuses a deadline reservation", async () => {
    vi.useFakeTimers(); const p = payment(); let reject!: (error: unknown) => void;
    const get = vi.fn().mockImplementationOnce(() => new Promise((_r, j) => { reject = j; })).mockResolvedValue({ data: p });
    setup(get, p.id); await advance(25_000);
    const limit = new ApiProblemError({ type: "about:blank", title: "Synthetic", status: 429, code: "RATE_LIMITED", request_id: "synthetic", retryable: true, retry_after_seconds: 20 });
    await act(async () => reject(limit)); await advance(19_999); expect(get).toHaveBeenCalledOnce(); await advance(1); expect(get).toHaveBeenCalledTimes(2);
    await advance(255_000); const count = get.mock.calls.length; await advance(30_000); expect(get).toHaveBeenCalledTimes(count);
  });
  it("ignores non-success after deadline but rejects mismatched late success", async () => {
    vi.useFakeTimers(); const p = payment(); let resolve!: (v: { data: Payment }) => void;
    const get = vi.fn().mockResolvedValueOnce({ data: p }).mockImplementationOnce(() => new Promise(r => { resolve = r; }));
    const view = setup(get, p.id); await advance(300_000); expect(view.result.current.status).toBe("delayed");
    await act(async () => resolve({ data: { ...p, id: id(), status: "succeeded" } })); expect(view.result.current.status).toBe("invalid");
  });
});

describe("purchase queue and session boundaries", () => {
  it("stores only UUIDs and timestamp, deduplicates and caps at five", async () => {
    const payments = Array.from({ length: 6 }, () => payment());
    for (const p of payments) await rememberPurchase(p, p.id, user);
    await rememberPurchase(payments[5]!, payments[5]!.id, user);
    expect(rows()).toHaveLength(5); expect(rows().some((r: { paymentId: string }) => r.paymentId === payments[0]!.id)).toBe(false);
    expect(Object.keys(rows()[0]).sort()).toEqual(["paymentId", "savedAt", "userId"]);
  });
  it.each(["konbini", "virtual_account"] as const)("never queues %s but thanks reporting remains possible", async method => {
    const p = payment(undefined, "succeeded", method); await rememberPurchase(p, p.id, user, "failed"); expect(rows()).toEqual([]);
    expect(await reportPurchaseComplete({ userId: user, revenue: 1000, paymentId: p.id })).toBe("pushed");
  });
  it.each(["failed", "in_progress"] as const)("recovers succeeded after reporting %s", async result => {
    const p = payment(undefined, "succeeded"); await rememberPurchase(p, p.id, user, result); expect(rows()).toHaveLength(1);
    await recoverPurchases({ getPayment: vi.fn().mockResolvedValue({ data: p }) }, user, null, active);
    expect(layer()).toHaveLength(1); expect(rows()).toEqual([]);
  });
  it.each([[401, "SESSION_EXPIRED"], [401, undefined], [403, "SMS_VERIFICATION_REQUIRED"], [403, "UNKNOWN"], [404, undefined], [404, "OTHER"], [429, "RATE_LIMITED"], [503, "ERROR"]])("preserves and stops after %s %s", async (status, code) => {
    const p = payment(); await rememberPurchase(p, p.id, user); const get = vi.fn().mockRejectedValue(problem(status as number, code as string | undefined));
    await recoverPurchases({ getPayment: get }, user, null, active); expect(rows()).toHaveLength(1); expect(get).toHaveBeenCalledOnce(); expect(layer()).toBeUndefined();
  });
  it("only deletes a read failure for 404 PAYMENT_NOT_FOUND", async () => {
    const p = payment(); await rememberPurchase(p, p.id, user); await recoverPurchases({ getPayment: vi.fn().mockRejectedValue(problem(404, "PAYMENT_NOT_FOUND")) }, user, null, active); expect(rows()).toEqual([]);
  });
  it("aborts during email hashing without changing the pending record", async () => {
    const p = payment(undefined, "succeeded"); await rememberPurchase(p, p.id, user, "failed"); let valid = true; let finish!: (value: ArrayBuffer) => void;
    vi.stubGlobal("crypto", { subtle: { digest: () => new Promise<ArrayBuffer>(r => { finish = r; }) } });
    const run = recoverPurchases({ getPayment: vi.fn().mockResolvedValue({ data: p }) }, user, "synthetic@example.test", () => valid);
    await vi.waitFor(() => expect(finish).toBeTypeOf("function")); valid = false; finish(new ArrayBuffer(32)); await run;
    expect(layer()).toBeUndefined(); expect(rows()).toHaveLength(1);
  });
  it("does not update after waiting for the queue lock if session became invalid", async () => {
    const p = payment(); await rememberPurchase(p, p.id, user); let valid = true;
    vi.stubGlobal("navigator", { locks: { request: async (_name: string, _opts: unknown, callback: (lock: object) => unknown) => { valid = false; return callback({}); } } });
    await updatePendingPurchases(() => [], () => valid, user); expect(rows()).toHaveLength(1);
  });
  it("serializes two independent tabs across sent-check, hashing, push and marker", async () => {
    const held = new Set<string>();
    vi.stubGlobal("navigator", { locks: { request: async (name: string, options: { ifAvailable: boolean }, callback: (lock: object | null) => unknown) => {
      if (options.ifAvailable && held.has(name)) return callback(null);
      held.add(name); try { return await callback({}); } finally { held.delete(name); }
    } } });
    vi.resetModules(); const first = await import("@/lib/analytics/gtm");
    vi.resetModules(); const second = await import("@/lib/analytics/gtm");
    const input = { userId: user, email: "synthetic@example.test", revenue: 1000, paymentId: id() };
    const result = await Promise.all([first.reportPurchaseComplete(input), second.reportPurchaseComplete(input)]);
    expect(result).toContain("pushed"); expect(result).toContain("in_progress"); expect(layer()).toHaveLength(1);
    expect(await second.reportPurchaseComplete(input)).toBe("already_sent");
  });
  it("retains records for aborted reporting but removes not_applicable", async () => {
    const p = payment(undefined, "succeeded"); await rememberPurchase(p, p.id, user, "failed");
    expect(await reportPurchaseComplete({ userId: user, email: "synthetic@example.test", revenue: 1000, paymentId: p.id, isActive: () => false })).toBe("aborted");
    await rememberPurchase(p, p.id, user, "aborted"); expect(rows()).toHaveLength(1);
    await rememberPurchase(p, p.id, user, "not_applicable"); expect(rows()).toEqual([]);
  });
  it.each(["failed", "canceled", "expired"] as const)("removes terminal %s without sending", async status => {
    const p = payment(); await rememberPurchase(p, p.id, user);
    await recoverPurchases({ getPayment: vi.fn().mockResolvedValue({ data: { ...p, status } }) }, user, null, active);
    expect(rows()).toEqual([]); expect(layer()).toBeUndefined();
  });
  it.each(["konbini", "virtual_account", "mismatch"])("rejects a recovered %s response", async method => {
    const p = payment(); await rememberPurchase(p, p.id, user);
    const response = { ...p, status: "succeeded", ...(method === "mismatch" ? { id: id() } : { method }) };
    await recoverPurchases({ getPayment: vi.fn().mockResolvedValue({ data: response }) }, user, null, active);
    expect(rows()).toEqual([]); expect(layer()).toBeUndefined();
  });
  it("does not touch another member and expires only current member records", async () => {
    const foreignUser = "10000000-0000-4000-8000-000000000002"; const p = payment();
    const foreign = { paymentId: id(), userId: foreignUser, savedAt: Date.now() - 90_000_000 };
    await updatePendingPurchases(() => [foreign, { paymentId: p.id, userId: user, savedAt: Date.now() - 90_000_000 }], active, foreignUser);
    // Seed an expired record to exercise real recovery cleanup, including another user's history.
    window.localStorage.setItem(PENDING_PURCHASE_KEY, JSON.stringify([foreign, { paymentId: p.id, userId: user, savedAt: Date.now() - 90_000_000 }]));
    const get = vi.fn(); await recoverPurchases({ getPayment: get }, user, null, active);
    expect(get).not.toHaveBeenCalled(); expect(rows()).toEqual([foreign]);
  });
  it("retains and stops when logout happens during GET, before a second GET", async () => {
    const p = payment(); const second = payment(); await rememberPurchase(p, p.id, user); await rememberPurchase(second, second.id, user);
    let valid = true; const get = vi.fn(async () => { valid = false; return { data: { ...p, status: "succeeded" } as Payment, metadata: { status: 200, idempotency_replayed: false } }; });
    await recoverPurchases({ getPayment: get }, user, null, () => valid);
    expect(get).toHaveBeenCalledOnce(); expect(rows()).toHaveLength(2); expect(layer()).toBeUndefined();
  });
  it("does not access storage or GET with GTM disabled", async () => {
    vi.stubEnv("NEXT_PUBLIC_GTM_ID", ""); const storage = vi.spyOn(window, "localStorage", "get"); const get = vi.fn();
    const p = payment(); await rememberPurchase(p, p.id, user); await recoverPurchases({ getPayment: get }, user, null, active);
    expect(storage).not.toHaveBeenCalled(); expect(get).not.toHaveBeenCalled();
  });
  it("merges concurrent queue updates from independent tabs and releases the queue before GET", async () => {
    const a = payment(), b = payment(); await rememberPurchase(b, b.id, user);
    let tail: Promise<unknown> = Promise.resolve(); let held = false;
    vi.stubGlobal("navigator", { locks: { request: (_name: string, _options: unknown, action: (lock: object) => unknown) => {
      const run = tail.then(async () => { held = true; try { return await action({}); } finally { held = false; } }); tail = run.catch(() => {}); return run;
    } } });
    vi.resetModules(); const tabA = await import("@/lib/analytics/purchase-recovery");
    vi.resetModules(); const tabB = await import("@/lib/analytics/purchase-recovery");
    await Promise.all([
      tabA.updatePendingPurchases(rows => [...rows, { paymentId: a.id, userId: user, savedAt: Date.now() }]),
      tabB.updatePendingPurchases(rows => rows.filter(row => row.paymentId !== b.id)),
    ]);
    expect(rows().map((row: { paymentId: string }) => row.paymentId)).toEqual([a.id]);
    const get = vi.fn(async () => { expect(held).toBe(false); return { data: a, metadata: { status: 200, idempotency_replayed: false } }; });
    await tabA.recoverPurchases({ getPayment: get }, user, null, active); expect(get).toHaveBeenCalledOnce();
  });
});
