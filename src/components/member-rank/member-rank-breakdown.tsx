import type { MemberRankBreakdown } from "@/lib/platform/member-rank-client";
import { formatRankNumber } from "./member-rank-parts";

/** Compare API totals only. Recent purchases are not an accounting ledger. */
export function isConsistentBreakdown(value: MemberRankBreakdown, rankPoints: number): boolean {
  return Number.isSafeInteger(value.total) && value.total >= 0 && value.total === rankPoints;
}

const shortDate = new Intl.DateTimeFormat("ja-JP", { day: "2-digit", month: "2-digit", timeZone: "Asia/Tokyo" });

export function MemberRankBreakdownSection({ breakdown, rankPoints }: { readonly breakdown: MemberRankBreakdown; readonly rankPoints: number }) {
  if (!isConsistentBreakdown(breakdown, rankPoints)) return null;
  const recent = breakdown.recent
    .filter((entry) => entry.kind === "purchase" && Number.isSafeInteger(entry.points) && entry.points > 0 && Number.isFinite(Date.parse(entry.occurred_at)))
    .sort((left, right) => Date.parse(right.occurred_at) - Date.parse(left.occurred_at)).slice(0, 3);
  return (
    <section aria-labelledby="mrank-breakdown-heading" className="mrank-panel">
      <div className="mrank-panel__head">
        <div>
          <h2 id="mrank-breakdown-heading">ランクポイントの内訳</h2>
          <p>コイン購入履歴は最新3件です。全期間の累計には購入以外の反映分も含まれるため、履歴の合計と異なる場合があります。</p>
        </div>
      </div>
      <ul aria-label="コイン購入履歴" className="mrank-calc">
        {recent.length === 0 ? <li><span>コインの購入履歴はありません</span></li> : recent.map((entry, index) => (
          <li key={`${entry.occurred_at}-${index}`}>
            <span>{shortDate.format(new Date(entry.occurred_at))}　{entry.label}</span>
            <b>+{formatRankNumber(entry.points)}</b>
          </li>
        ))}
        <li className="is-sum"><span>ランクポイント（これまでの合計）</span><b>{formatRankNumber(breakdown.total)}</b></li>
      </ul>
    </section>
  );
}
