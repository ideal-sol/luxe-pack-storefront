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
  { href: "/points", icon: "points", label: "ポイント" },
  { href: "/notices", icon: "notice", label: "お知らせ" },
] as const satisfies readonly NavigationItem[];

export const mobileNavigation = [
  { href: "/", icon: "home", label: "ホーム" },
  ...primaryNavigation,
  { href: "/mypage", icon: "account", label: "マイページ" },
] as const satisfies readonly NavigationItem[];

export const accountNavigation = [
  { href: "/mypage", label: "マイページ" },
  { href: "/mypage/points", label: "ポイント履歴" },
  { href: "/mypage/draws", label: "ガチャ履歴" },
  { href: "/mypage/prizes", label: "獲得アイテム" },
  { href: "/mypage/line", label: "LINE連携" },
] as const;

export const publicRoutes = [
  "/",
  "/gachas",
  "/gachas/[slug]",
  "/login",
  "/register",
  "/points",
  "/notices",
  "/notices/[noticeId]",
  "/pages/[slug]",
  "/mypage",
  "/mypage/points",
  "/mypage/draws",
  "/mypage/prizes",
  "/mypage/line",
] as const;
