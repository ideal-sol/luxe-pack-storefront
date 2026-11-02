import { createStorefrontMemberRankClient, type PublicComponents } from "@oripa/storefront-client";
import { createBrowserPlatformTransport } from "./browser-client";

type MemberRankSchemas = PublicComponents["schemas"];

/** 公開の会員ランク設定 1段分（GET /member-ranks）。 */
export type MemberRankSetting = MemberRankSchemas["MemberRankPublicSetting"];
export type MemberRankCode = MemberRankSetting["code"];

/** 内訳表示の準備用。現行API契約には含めず、履歴を生成しない。 */
export interface MemberRankBreakdownEntry {
  readonly occurred_at: string;
  readonly kind: "purchase" | "manual" | "refund";
  readonly points: number;
  readonly label: string;
}

/** 他サイトからの移行分（引き継ぎ）。 */
export interface MemberRankTransfer {
  readonly status: "transferred";
  readonly equivalent_rank: { readonly code: MemberRankCode; readonly name: string; readonly level: number };
  readonly points: number;
}

export interface MemberRankBreakdown {
  readonly recent: readonly MemberRankBreakdownEntry[];
  /** recent より前の明細（購入・調整・返金の減算）の合計。total ＝ recent の合計 ＋ earlier_total ＋ transfer.points */
  readonly earlier_total: number;
  readonly transfer: MemberRankTransfer | null;
  readonly total: number;
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
