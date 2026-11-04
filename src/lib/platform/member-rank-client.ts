import { createStorefrontMemberRankClient, type PublicComponents } from "@oripa/storefront-client";
import { createBrowserPlatformTransport } from "./browser-client";

type MemberRankSchemas = PublicComponents["schemas"];

/** 公開の会員ランク設定 1段分（GET /member-ranks）。 */
export type MemberRankSetting = MemberRankSchemas["MemberRankPublicSetting"];
export type MemberRankCode = MemberRankSetting["code"];

/** Presentation input from merged Public OpenAPI alpha.45; NOT generated Client compatibility.
 * Replace with generated aliases only after the formal Artifact handoff. */
export interface MemberRankBreakdown {
  readonly recent: readonly { readonly occurred_at: string; readonly kind: "purchase"; readonly points: number; readonly label: string }[];
  readonly total: number;
}

export type CumulativeMemberRank = Omit<Extract<MyMemberRank, { enabled: true }>, "period" | "maintain" | "demotion_protection"> & {
  readonly point_basis: "cumulative";
  readonly period: null;
  readonly maintain: null;
  readonly demotion_protection: null;
  readonly breakdown: MemberRankBreakdown;
  readonly promotion_bonus: { readonly received: boolean };
  readonly transferred: boolean;
};

/** Display guard only; the pinned transport and generated response type stay unchanged. */
export function isCumulativeMemberRank(value: unknown): value is CumulativeMemberRank {
  if (!value || typeof value !== "object") return false;
  const rank = value as Partial<CumulativeMemberRank>;
  return rank.enabled === true && rank.point_basis === "cumulative"
    && rank.period === null && rank.maintain === null && rank.demotion_protection === null
    && Number.isSafeInteger(rank.rank_points) && rank.rank_points! >= 0
    && !!rank.breakdown && Array.isArray(rank.breakdown.recent)
    && typeof rank.promotion_bonus?.received === "boolean" && typeof rank.transferred === "boolean";
}

export type MyMemberRank = MemberRankSchemas["MyMemberRankResponse"]["data"];

/** ログイン中の会員の会員ランク（GET /me/member-rank）。 */
export async function loadMyMemberRank(): Promise<MyMemberRank> {
  const { data } = await createStorefrontMemberRankClient(createBrowserPlatformTransport()).getMyMemberRank();
  return data.data;
}

/** 7段の会員ランク設定（GET /member-ranks）。機能が無効のときは空の一覧。段の低い順に並べて返す。 */
export async function listMemberRanks(): Promise<readonly MemberRankSetting[]> {
  const { data } = await createStorefrontMemberRankClient(createBrowserPlatformTransport()).listMemberRanks();
  return [...data.data].sort((left, right) => left.level - right.level);
}
