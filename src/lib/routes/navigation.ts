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
  { href: "/mypage/points", label: "コイン履歴" },
  { href: "/mypage/draws", label: "ガチャ履歴" },
  { href: "/mypage/prizes", label: "獲得アイテム" },
  { href: "/mypage/line", label: "LINE連携" },
] as const;

export const lineAccountRoute = accountNavigation[4].href;

export function drawResultRoute(drawRequestId: string) {
  return `/draws/${encodeURIComponent(drawRequestId)}/result`;
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
  { ...accountNavigation[1], description: "コイン情報を確認する", eyebrow: "COINS" },
  { ...accountNavigation[2], description: "ガチャの利用履歴を確認する", eyebrow: "DRAW HISTORY" },
  { ...accountNavigation[3], description: "獲得した景品を確認する", eyebrow: "PRIZES" },
] as const;

export const myPageAccountNavigation = [
  { ...accountNavigation[4], description: "LINE連携の設定を確認する" },
] as const;

export const myPageSupportNavigation = [
  { href: "/contact", label: "お問い合わせ", description: "商品やサービスについて問い合わせる" },
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
  "/notices",
  "/notices/[noticeId]",
  "/pages/[slug]",
  "/contact",
  "/mypage",
  "/mypage/points",
  "/mypage/draws",
  "/mypage/prizes",
  "/mypage/line",
] as const;
