import type { MemberRankBreakdown } from "@/lib/platform/member-rank-client";
import { formatRankNumber } from "./member-rank-parts";

/** Display consistency only: adjustments/refunds already belong to recent or earlier_total. */
export function isConsistentBreakdown(value: MemberRankBreakdown): boolean {
  const amounts = [value.total, value.earlier_total, value.transfer?.points ?? 0, ...value.recent.map((entry) => entry.points)];
  return amounts.every(Number.isSafeInteger)
    && value.recent.every((entry) => Number.isFinite(Date.parse(entry.occurred_at)))
    && value.total === value.earlier_total + (value.transfer?.points ?? 0) + value.recent.reduce((sum, entry) => sum + entry.points, 0);
}

const shortDate = new Intl.DateTimeFormat("ja-JP", { day: "2-digit", month: "2-digit", timeZone: "Asia/Tokyo" });
function signed(value: number) {
  return value < 0 ? `−${formatRankNumber(-value)}` : `+${formatRankNumber(value)}`;
}

/** Prepared for a future approved contract and Human display authorization; never mounted in the user page. */
export function MemberRankBreakdownSection({ breakdown }: { readonly breakdown: MemberRankBreakdown }) {
  if (!isConsistentBreakdown(breakdown)) return null;
  const recent = [...breakdown.recent].sort((left, right) => left.occurred_at.localeCompare(right.occurred_at));
  const transfer = breakdown.transfer;
  const empty = breakdown.total === 0 && recent.length === 0 && !transfer && breakdown.earlier_total === 0;
  return (
    <section aria-labelledby="mrank-breakdown-heading" className="mrank-panel">
      <div className="mrank-panel__head">
        <div>
          <h2 id="mrank-breakdown-heading">ランクポイントの内訳</h2>
          <p>提供された明細と集計を表示しています。</p>
        </div>
      </div>
      <ul className="mrank-calc">
        {empty ? (
          <li><span>コインのご購入はまだありません</span><b>0</b></li>
        ) : (
          <>
            {transfer ? (
              <li><span>他サイトからの移行（{transfer.equivalent_rank.name}相当）</span><b>{signed(transfer.points)}</b></li>
            ) : null}
            {breakdown.earlier_total !== 0 ? (
              <li><span>それ以前の分（合計）</span><b>{signed(breakdown.earlier_total)}</b></li>
            ) : null}
            {recent.map((entry, index) => (
              <li key={`${entry.occurred_at}-${index}`}>
                <span>{shortDate.format(new Date(entry.occurred_at))}　{entry.label}</span>
                <b>{signed(entry.points)}</b>
              </li>
            ))}
          </>
        )}
        <li className="is-excluded"><span>おまけの無償コイン<span className="mrank-calc__tag">加算されません</span></span><b>0</b></li>
        <li className="is-excluded"><span>ガチャで使ったコイン<span className="mrank-calc__tag">加算されません</span></span><b>0</b></li>
        <li className="is-sum"><span>ランクポイント合計</span><b>{formatRankNumber(breakdown.total)}</b></li>
      </ul>
    </section>
  );
}
