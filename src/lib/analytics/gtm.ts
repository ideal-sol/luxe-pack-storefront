/**
 * Google Tag Manager（広告のコンバージョン計測）。
 * コンテナIDは NEXT_PUBLIC_GTM_ID（ビルド時に埋め込まれる）。未設定・形式違いなら何も出さない。
 * dataLayer は会員UUID・SHA-256メール、決済完了時のみ支払額・決済UUID。
 * 生メール・電話番号・氏名・住所・OTPは送信しない。
 */
const GTM_ID_PATTERN = /^GTM-[A-Z0-9]{4,12}$/;
const REGISTRATION_COMPLETE_KEY_PREFIX = "oripoke:cv:registration_complete:";

type DataLayerEvent = {
  readonly event: "registration_complete" | "purchase_complete";
  readonly user_id?: string;
  readonly user_email?: string | undefined;
  readonly revenue?: number;
  readonly transaction_id?: string;
};
const registrationInFlight = new Set<string>();
const purchaseInFlight = new Set<string>();
const purchaseSent = new Set<string>();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type DataLayerWindow = Window & { dataLayer?: unknown[] };

export function gtmContainerId(): string | null {
  const value = process.env.NEXT_PUBLIC_GTM_ID?.trim() ?? "";
  return GTM_ID_PATTERN.test(value) ? value : null;
}

export function pushDataLayerEvent(event: DataLayerEvent): boolean {
  try {
    if (!gtmContainerId() || typeof window === "undefined") return false;
    if (!event.user_id || !["registration_complete", "purchase_complete"].includes(event.event)) return false;
    if (event.event === "purchase_complete" && !validPurchase(event.user_id, event.revenue, event.transaction_id)) return false;
    const target = window as DataLayerWindow;
    if (target.dataLayer === undefined) target.dataLayer = [];
    if (!Array.isArray(target.dataLayer)) return false;
    target.dataLayer.push({
      event: event.event,
      ...(event.user_id ? { user_id: event.user_id } : {}),
      ...(/^[a-f0-9]{64}$/.test(event.user_email ?? "") ? { user_email: event.user_email } : {}),
      ...(event.event === "purchase_complete" ? { revenue: event.revenue, transaction_id: event.transaction_id } : {}),
    });
    return true;
  } catch {
    // 計測の失敗は認証・画面遷移へ伝播させない。
    return false;
  }
}

/**
 * 初回 SMS 認証成功を通知する。保存可能な同一ブラウザ内だけの重複抑止。
 * 別ブラウザ・別端末・保存拒否や消去後の完全な一意性は保証しない。
 * 短いハッシュは匿名化や一意性を保証するものではない。
 */
export async function reportRegistrationComplete(userKey: string | null, email?: string | null): Promise<void> {
  let reserved = false;
  try {
    // 無効時は dataLayer / localStorage の getter にも触らない。
    if (!gtmContainerId() || typeof window === "undefined" || !userKey) return;
    if (registrationInFlight.has(userKey)) return;
    registrationInFlight.add(userKey);
    reserved = true;
    const key = REGISTRATION_COMPLETE_KEY_PREFIX + compactKey(userKey);
    try {
      if (window.localStorage.getItem(key) === "1") return;
    } catch {
      // 保存拒否時も認証を継続する。重複抑止は best effort。
    }
    const userEmail = await hashEmail(email);
    if (!pushDataLayerEvent({ event: "registration_complete", user_id: userKey, user_email: userEmail })) return;
    try {
      window.localStorage.setItem(key, "1");
    } catch {
      // 計測は完了済み。保存失敗で認証を失敗させない。
    }
  } catch {
    // 計測処理の例外は SMS 成功・事前登録完了へ伝播させない。
  } finally {
    if (reserved && userKey) registrationInFlight.delete(userKey);
  }
}

async function hashEmail(email?: string | null): Promise<string | undefined> {
  try {
    const normalized = email?.normalize("NFKC").trim().toLowerCase();
    if (!normalized) return undefined;
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  } catch {
    // メール欠落・Crypto失敗はキーを省略し、CV自体は通知する。
    return undefined;
  }
}

function validPurchase(userId: unknown, revenue: unknown, paymentId: unknown): boolean {
  return typeof userId === "string" && UUID_PATTERN.test(userId)
    && typeof paymentId === "string" && UUID_PATTERN.test(paymentId)
    && typeof revenue === "number" && Number.isSafeInteger(revenue) && revenue > 0;
}

/** Platformが成功を確認したPaymentのみ呼び出す。保存拒否時も同一表示中は抑止。 */
export async function reportPurchaseComplete({ userId, email, revenue, paymentId }: {
  readonly userId: string | null;
  readonly email?: string | null | undefined;
  readonly revenue: number;
  readonly paymentId: string;
}): Promise<void> {
  let reserved = false;
  try {
    if (!gtmContainerId() || typeof window === "undefined" || !validPurchase(userId, revenue, paymentId)) return;
    if (purchaseInFlight.has(paymentId) || purchaseSent.has(paymentId)) return;
    purchaseInFlight.add(paymentId);
    reserved = true;
    const key = "oripoke:cv:purchase_complete:" + compactKey(paymentId);
    try {
      if (window.localStorage.getItem(key) === "1") return;
    } catch { /* 保存拒否時はメモリ上の抑止を使う。 */ }
    const userEmail = await hashEmail(email);
    if (!pushDataLayerEvent({ event: "purchase_complete", user_id: userId!, user_email: userEmail, revenue, transaction_id: paymentId })) return;
    purchaseSent.add(paymentId);
    try { window.localStorage.setItem(key, "1"); }
    catch { /* push済み。計測失敗を画面や決済へ伝播させない。 */ }
  } catch { /* 計測の失敗で決済処理を再実行しない。 */ }
  finally { if (reserved) purchaseInFlight.delete(paymentId); }
}

function compactKey(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
