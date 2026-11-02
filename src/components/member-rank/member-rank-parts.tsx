import type { MemberRankCode, MemberRankSetting } from "@/lib/platform/member-rank-client";

/** ランクの並び（色の番号）。デザイン _ランク.css の t0〜t6 に対応する。 */
const rankOrder: readonly MemberRankCode[] = ["beginner", "bronze", "silver", "gold", "platinum", "diamond", "vip"];

const rankNumber = new Intl.NumberFormat("ja-JP");

export function formatRankNumber(value: number) {
  return rankNumber.format(value);
}

/** ランクの色のクラス。札・帯・階段のどこでも同じランクは同じ色にする。 */
export function rankToneClass(code: string) {
  const index = rankOrder.indexOf(code as MemberRankCode);
  return `mrank-t${index < 0 ? 0 : index}`;
}

/** 購入ボーナス率（"1.00" などの文字列）を「1.0」の形にする。0 のときは null。 */
export function formatBonusRate(ratePercent: string | null | undefined): string | null {
  const rate = Number(ratePercent);
  if (!Number.isFinite(rate) || rate <= 0) return null;
  return rate.toFixed(2).replace(/0$/, "");
}

export function RankBadge({ code, name }: { readonly code: string; readonly name: string }) {
  return <span className={`mrank-badge ${rankToneClass(code)}`}>{name}</span>;
}

/** 7段の階段。いまのランクがあれば「いまここ」を付ける。幅が足りないときは箱の中だけ横にスクロールする。 */
export function RankLadder({
  currentCode,
  ranks,
}: {
  readonly currentCode?: string;
  readonly ranks: readonly MemberRankSetting[];
}) {
  return (
    <ol aria-label="会員ランクの段" className="mrank-ladder">
      {ranks.map((rank, index) => {
        const current = rank.code === currentCode;
        return (
          <li
            aria-current={current ? "step" : undefined}
            className={`mrank-ladder__step mrank-ladder__step--h${Math.min(index, 6)} ${rankToneClass(rank.code)}${current ? " is-current" : ""}`}
            key={rank.code}
          >
            <span className="mrank-ladder__name">{rank.name}</span>
            {rank.reach_line !== null ? <span className="mrank-ladder__line">{formatRankNumber(rank.reach_line)} 〜</span> : null}
            {current ? <span className="mrank-ladder__here">いまここ</span> : null}
          </li>
        );
      })}
    </ol>
  );
}
