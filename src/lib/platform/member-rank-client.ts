import { createStorefrontMemberRankClient, type PublicComponents } from "@oripa/storefront-client";
import { createBrowserPlatformTransport } from "./browser-client";

type MemberRankSchemas = PublicComponents["schemas"];

/** 公開の会員ランク設定 1段分（GET /member-ranks）。 */
export type MemberRankSetting = MemberRankSchemas["MemberRankPublicSetting"];
export type MemberRankCode = MemberRankSetting["code"];

/** Generated from the formally published alpha.49 Public API contract. */
export type CumulativeMemberRank = MemberRankSchemas["MyMemberRankEnabled"];
export type MemberRankBreakdown = CumulativeMemberRank["breakdown"];

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
