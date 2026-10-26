/**
 * Google Tag Manager（広告のコンバージョン計測）。
 * コンテナIDは NEXT_PUBLIC_GTM_ID（ビルド時に埋め込まれる）。未設定・形式違いなら何も出さない。
 * dataLayer には個人情報（メールアドレス・会員IDなど）を載せない。
 */
const GTM_ID_PATTERN = /^GTM-[A-Z0-9]{4,12}$/;
const REGISTRATION_COMPLETE_KEY_PREFIX = "oripoke:cv:registration_complete:";

type DataLayerEvent = { readonly event: string };
type DataLayerWindow = Window & { dataLayer?: unknown[] };

export function gtmContainerId(): string | null {
  const value = process.env.NEXT_PUBLIC_GTM_ID?.trim() ?? "";
  return GTM_ID_PATTERN.test(value) ? value : null;
}

export function pushDataLayerEvent(event: DataLayerEvent): boolean {
  try {
    if (!gtmContainerId() || typeof window === "undefined") return false;
    const target = window as DataLayerWindow;
    if (target.dataLayer === undefined) target.dataLayer = [];
    if (!Array.isArray(target.dataLayer)) return false;
    target.dataLayer.push({ event: event.event });
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
export function reportRegistrationComplete(userKey: string | null): void {
  try {
    // 無効時は dataLayer / localStorage の getter にも触らない。
    if (!gtmContainerId() || typeof window === "undefined" || !userKey) return;
    const key = REGISTRATION_COMPLETE_KEY_PREFIX + compactKey(userKey);
    try {
      if (window.localStorage.getItem(key) === "1") return;
    } catch {
      // 保存拒否時も認証を継続する。重複抑止は best effort。
    }
    if (!pushDataLayerEvent({ event: "registration_complete" })) return;
    try {
      window.localStorage.setItem(key, "1");
    } catch {
      // 計測は完了済み。保存失敗で認証を失敗させない。
    }
  } catch {
    // 計測処理の例外は SMS 成功・事前登録完了へ伝播させない。
  }
}

function compactKey(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}
