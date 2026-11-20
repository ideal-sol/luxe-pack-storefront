import type { Payment, PaymentClientAdapter, PaymentMethod } from "@/lib/platform";
import { isMissingRecoveryPayment } from "@/lib/platform/payment-problem";
import { gtmContainerId, purchaseAlreadySent, reportPurchaseComplete, withConversionLock, type PurchaseReportResult } from "./gtm";

export const PENDING_PURCHASE_KEY = "oripoke:cv:purchase_pending:v1";
export const RECOVERABLE_METHODS: Readonly<Partial<Record<PaymentMethod, number>>> = {
  credit_card: 86_400_000, paypay: 86_400_000, paidy: 86_400_000, netridecash: 86_400_000,
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type PendingPurchase = { paymentId: string; userId: string; savedAt: number };
const valid = (row: PendingPurchase) => row && UUID.test(row.paymentId) && UUID.test(row.userId) && Number.isSafeInteger(row.savedAt) && row.savedAt <= Date.now();
const recoverable = (payment: Payment) => RECOVERABLE_METHODS[payment.method] !== undefined;
const maximumAge = Math.max(...Object.values(RECOVERABLE_METHODS));

/** All queue read/modify/write operations share this lock. No network inside it. */
export async function updatePendingPurchases(mutator: (rows: PendingPurchase[]) => PendingPurchase[], isActive = () => true, userId?: string): Promise<PendingPurchase[]> {
  try {
    if (!gtmContainerId() || typeof window === "undefined") return [];
    return await withConversionLock(PENDING_PURCHASE_KEY, async () => {
      if (!isActive()) return [];
      const stored: unknown = JSON.parse(window.localStorage.getItem(PENDING_PURCHASE_KEY) ?? "[]");
      const rows: PendingPurchase[] = Array.isArray(stored) ? stored.filter(valid) : [];
      const next = mutator(rows).filter(row => valid(row) && (userId && row.userId !== userId || Date.now() - row.savedAt <= maximumAge));
      const unique = [...new Map(next.map(row => [row.paymentId, { paymentId: row.paymentId, userId: row.userId, savedAt: row.savedAt }])).values()];
      unique.sort((a, b) => a.savedAt - b.savedAt);
      if (!isActive()) return [];
      window.localStorage.setItem(PENDING_PURCHASE_KEY, JSON.stringify(unique.slice(-5)));
      return unique.slice(-5);
    }, [], false);
  } catch { return []; }
}

export async function rememberPurchase(payment: Payment, pid: string | null, userId: string, result?: PurchaseReportResult, isActive = () => true): Promise<void> {
  if (!gtmContainerId() || !UUID.test(userId) || payment.id !== pid || !UUID.test(payment.id) || !isActive()) return;
  if (result === "aborted") return;
  const terminal = ["failed", "canceled", "expired"].includes(payment.status);
  const remove = !recoverable(payment) || terminal || result === "not_applicable" || result === "pushed" || result === "already_sent" || purchaseAlreadySent(payment.id);
  const save = !remove && (payment.status !== "succeeded" || result === "in_progress" || result === "failed");
  if (!remove && !save) return;
  await updatePendingPurchases(rows => {
    const existing = rows.find(row => row.paymentId === payment.id);
    const remaining = rows.filter(row => row.paymentId !== payment.id);
    return save ? [...remaining, existing ?? { paymentId: payment.id, userId, savedAt: Date.now() }] : remaining;
  }, isActive, userId);
}

export async function recoverPurchases(client: Pick<PaymentClientAdapter, "getPayment">, userId: string, email: string | null | undefined, isActive: () => boolean): Promise<void> {
  try {
    if (!gtmContainerId() || !UUID.test(userId) || !isActive()) return;
    const rows = await updatePendingPurchases(rows => rows, isActive, userId);
    const remove = (paymentId: string) => updatePendingPurchases(rows => rows.filter(row => row.paymentId !== paymentId || row.userId !== userId), isActive, userId);
    for (const row of rows.filter(row => row.userId === userId)) {
      if (!isActive()) return;
      let payment: Payment;
      try { payment = (await client.getPayment(row.paymentId)).data; }
      catch (error) {
        if (!isActive()) return;
        if (isMissingRecoveryPayment(error)) { await remove(row.paymentId); continue; }
        return;
      }
      if (!isActive()) return;
      if (payment.id !== row.paymentId || !recoverable(payment) || Date.now() - row.savedAt > RECOVERABLE_METHODS[payment.method]! || ["failed", "canceled", "expired"].includes(payment.status)) { await remove(row.paymentId); continue; }
      if (payment.status !== "succeeded" || payment.amount.currency !== "JPY") continue;
      const result = await reportPurchaseComplete({ userId, email, revenue: payment.amount.amount, paymentId: payment.id, isActive });
      if (!isActive() || result === "aborted") return;
      if (["pushed", "already_sent", "not_applicable"].includes(result)) await remove(row.paymentId);
    }
  } catch { /* Optional analytics must never affect the session or purchase. */ }
}
