import Link from "next/link";
import type { MyMemberRank } from "@/lib/platform/member-rank-client";
import { memberRankRoute } from "@/lib/routes/navigation";
import { formatRankNumber, RankBadge } from "./member-rank-parts";

/** マイページ入口の1行の帯（デザイン 01 の上の帯）。機能が無効のときは出さない。 */
export function MemberRankBand({ rank }: { readonly rank: MyMemberRank | null }) {
  if (!rank?.enabled) return null;
  const next = rank.next_rank;
  return (
    <section aria-label="会員ランク" className="mrank-band">
      <RankBadge code={rank.rank.code} name={rank.rank.name} />
      <span className="mrank-band__text">ランクポイント <b>{formatRankNumber(rank.rank_points)}</b></span>
      <span className="mrank-band__spacer" />
      <span className="mrank-band__text">
        {next
          ? <>次の <b>{next.name}</b> まであと <b>{formatRankNumber(next.remaining)}</b> ランクポイント</>
          : "最上位のランクです"}
      </span>
      <Link className="mrank-pill-link" href={memberRankRoute}>会員ランクを見る</Link>
    </section>
  );
}
