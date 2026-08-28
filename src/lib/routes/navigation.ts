export type NavigationIcon =
  | "home"
  | "pack"
  | "points"
  | "notice"
  | "account";

export interface NavigationItem {
  readonly href: string;
  readonly icon: NavigationIcon;
  readonly label: string;
}

export const primaryNavigation = [
  { href: "/gachas", icon: "pack", label: "パック" },
  { href: "/points", icon: "points", label: "コイン" },
  { href: "/notices", icon: "notice", label: "お知らせ" },
] as const satisfies readonly NavigationItem[];

export const mobileNavigation = [
  { href: "/", icon: "home", label: "ホーム" },
  ...primaryNavigation,
  { href: "/mypage", icon: "account", label: "マイページ" },
] as const satisfies readonly NavigationItem[];

export const accountNavigation = [
  { href: "/mypage", label: "マイページ" },
  { href: "/mypage/purchases", label: "購入履歴" },
  { href: "/mypage/points", label: "コイン履歴" },
  { href: "/mypage/draws", label: "ガチャ履歴" },
  { href: "/mypage/prizes", label: "獲得アイテム" },
  { href: "/mypage/address", label: "お届け先登録" },
  { href: "/mypage/line", label: "LINE連携" },
] as const;

export const lineAccountRoute = accountNavigation[6].href;

export function drawResultRoute(drawRequestId: string) {
  return `/draws/${encodeURIComponent(drawRequestId)}/result`;
}

export function pointPurchaseDetailRoute(productId: string) {
  return `/points/purchase/${encodeURIComponent(productId)}`;
}

export function paymentHistoryDetailRoute(paymentId: string) {
  return `/mypage/purchases/${encodeURIComponent(paymentId)}`;
}

export function staticPageRoute(slug: string) {
  return `/pages/${encodeURIComponent(slug)}`;
}

export const informationNavigation = [
  { href: "/pages/guide", label: "ご利用ガイド" },
  { href: "/pages/terms", label: "利用規約" },
  { href: "/pages/privacy", label: "プライバシーポリシー" },
] as const;

export const myPageShortcutNavigation = [
  { ...accountNavigation[1], description: "コイン購入の履歴を確認する", eyebrow: "PURCHASES" },
  { ...accountNavigation[2], description: "コイン情報を確認する", eyebrow: "COINS" },
  { ...accountNavigation[3], description: "ガチャの利用履歴を確認する", eyebrow: "DRAW HISTORY" },
  { ...accountNavigation[4], description: "獲得した景品を確認する", eyebrow: "PRIZES" },
] as const;

export const myPageAccountNavigation = [
  { ...accountNavigation[5], description: "景品のお届け先を登録・変更する" },
] as const;

export const myPageSupportNavigation = [
  { href: "https://support.luxe-pack.biz/", label: "お問い合わせ", description: "商品やサービスについて問い合わせる" },
  { ...primaryNavigation[2], description: "Luxe Packからのお知らせ" },
  { ...informationNavigation[0], description: "Storefrontの利用方法" },
  { ...informationNavigation[1], description: "サービスの利用条件" },
  { ...informationNavigation[2], description: "個人情報の取り扱い" },
] as const;

export const publicRoutes = [
  "/",
  "/gachas",
  "/gachas/[slug]",
  "/draws/[drawRequestId]/result",
  "/login",
  "/register",
  "/verify-email",
  "/verify-email/error",
  "/verify-email/[userId]/[hash]",
  "/points",
  "/points/purchase/[productId]",
  "/notices",
  "/notices/[noticeId]",
  "/pages/[slug]",
  "/contact",
  "/mypage",
  "/mypage/purchases",
  "/mypage/purchases/[paymentId]",
  "/mypage/points",
  "/mypage/draws",
  "/mypage/prizes",
  "/mypage/address",
  "/mypage/line",
] as const;
