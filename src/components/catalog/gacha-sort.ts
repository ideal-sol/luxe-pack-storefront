import type { GachaSummary } from "@/lib/platform";

/**
 * トップのガチャ一覧の並べ替え（デザインの「並べ替え」操作列）。
 * Public API に並べ替えの指定がないため、取得済みの一覧をこの画面の中だけで並べ替える。
 * 販売・抽選・表示可否の判断には使わず、並び順だけを変える。
 */
export const gachaSortOptions = [
  { key: "recommended", label: "おすすめ順" },
  { key: "price-desc", label: "単価が高い順" },
  { key: "remaining-asc", label: "残りが少ない順" },
  { key: "newest", label: "新着順" },
  { key: "total-desc", label: "口数が多い順" },
] as const;

export type GachaSortKey = (typeof gachaSortOptions)[number]["key"];

/** おすすめ順以外は、並べ替えの母数をそろえるため Public API の上限件数まで取得する。 */
export const gachaSortFetchLimit = 100;

export function sortGachas(gachas: readonly GachaSummary[], key: GachaSortKey): readonly GachaSummary[] {
  if (key === "recommended") return gachas;
  const indexed = gachas.map((gacha, index) => ({ gacha, index }));
  const difference = (left: GachaSummary, right: GachaSummary) => {
    switch (key) {
      case "price-desc":
        return right.price_points - left.price_points;
      case "remaining-asc":
        return left.remaining_count - right.remaining_count;
      case "newest":
        return right.publish_start_at.localeCompare(left.publish_start_at);
      case "total-desc":
        return right.total_count - left.total_count;
    }
  };
  // 同じ値のときは元の（おすすめ）順を保つ
  return indexed
    .sort((left, right) => difference(left.gacha, right.gacha) || left.index - right.index)
    .map(({ gacha }) => gacha);
}
