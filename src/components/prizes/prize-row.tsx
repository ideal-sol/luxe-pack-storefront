import { CatalogAsset } from "@/components/catalog/catalog-asset";
import type { UserPrize } from "@/lib/platform";
import { presentCoinTerminology } from "@/lib/presentation/coin-terminology";

/**
 * 景品1件（または同じ景品のまとめ）の行。抽選結果と獲得アイテムで共通（デザイン 2026-10-31「画面改修案」）。
 * 札は「状態」（角丸の塗り＋点）と「等級」（四角い枠線）で形を変え、並んでも取り違えないようにする。
 */

export type PrizeStateTone = "stored" | "expire" | "shipping" | "done";
export type PrizeStatusFilter = "stored" | "shipping" | "done" | "all";

/** 保管期限がこの日数以内なら「保管中・期限まで◯日」と目立たせる */
export const PRIZE_EXPIRY_WARNING_DAYS = 2;
const DAY_MS = 24 * 60 * 60 * 1000;
const number = new Intl.NumberFormat("ja-JP");

export function formatPrizeDate(value: string) {
  return new Intl.DateTimeFormat("ja-JP", { day: "2-digit", month: "2-digit", timeZone: "Asia/Tokyo", year: "numeric" }).format(new Date(value));
}

export function prizeStatusFilter(prize: UserPrize): Exclude<PrizeStatusFilter, "all"> {
  switch (prize.status) {
    case "stored": return "stored";
    case "shipping_requested":
    case "packing":
    case "shipped":
    case "delivered":
    case "hold":
    case "return_requested":
      return "shipping";
    default:
      return "done";
  }
}

const statusText: Readonly<Record<UserPrize["status"], string>> = {
  canceled: "取消",
  converted: "コイン交換済み",
  delivered: "配送完了",
  exchange_processing: "コイン交換処理中",
  expired: "保管期限終了",
  hold: "保留",
  packing: "梱包中",
  returned: "返送済み",
  return_requested: "返送手続中",
  shipped: "発送済み",
  shipping_requested: "発送依頼済み",
  stored: "保管中",
};

export function prizeStatusBadge(prize: UserPrize, now: number = Date.now()): { readonly label: string; readonly tone: PrizeStateTone } {
  const group = prizeStatusFilter(prize);
  if (group === "stored") {
    const left = Math.ceil((new Date(prize.storage_expires_at).getTime() - now) / DAY_MS);
    if (left >= 0 && left <= PRIZE_EXPIRY_WARNING_DAYS) return { label: left === 0 ? "保管中・本日まで" : `保管中・期限まで${left}日`, tone: "expire" };
    return { label: "保管中", tone: "stored" };
  }
  return { label: statusText[prize.status], tone: group === "shipping" ? "shipping" : "done" };
}

export function prizeStateNote(prize: UserPrize): string | null {
  if (prize.status === "shipping_requested" || prize.status === "packing") return "発送のご依頼を受け付けました。発送までお待ちください。";
  if (prize.status === "shipped") return "発送しました。お届けまでお待ちください。";
  if (prize.status === "converted") return `${number.format(prize.exchange_points)}コインでお受け取り済みです。`;
  return null;
}

export function prizeName(prize: UserPrize): string {
  return presentCoinTerminology(prize.presentation?.name ?? "景品情報を表示できません");
}

export function PrizeRow({
  checked,
  count = 1,
  disabled,
  extraNote,
  onToggle,
  prize,
  totalPoints,
}: {
  readonly checked: boolean;
  /** 同じ景品をまとめて1行にしたときの件数 */
  readonly count?: number;
  readonly disabled: boolean;
  /** 状態の説明のほかに出す一文（選択できない理由など） */
  readonly extraNote?: string | null;
  readonly onToggle: (checked: boolean) => void;
  readonly prize: UserPrize;
  /** 右側に出すコイン（まとめた行は合計） */
  readonly totalPoints?: number;
}) {
  const presentation = prize.presentation;
  const image = presentation?.image?.media_type === "image" ? presentation.image : null;
  const name = prizeName(prize);
  const badge = prizeStatusBadge(prize);
  const done = prize.status === "converted";
  const off = disabled && !checked;
  const note = prizeStateNote(prize);
  return (
    <article className={`prize-row${checked ? " prize-row--selected" : ""}${off ? " prize-row--off" : ""}`}>
      <label className="prize-row__select">
        <input
          aria-label={`${name}を選択`}
          checked={checked}
          disabled={disabled}
          onChange={(event) => onToggle(event.currentTarget.checked)}
          type="checkbox"
        />
        <span aria-hidden="true" className="prize-row__tick" />
      </label>
      <div className="prize-row__image">
        <CatalogAsset alt={image?.alt_text ?? name} fallbackLabel="PRIZE IMAGE" {...(image?.path ? { src: image.path } : {})} />
      </div>
      <div className="prize-row__body">
        <div className="prize-row__badges">
          <span className={`prize-state prize-state--${badge.tone}`}>{badge.label}</span>
          {presentation?.rank && <span className="prize-tier">{presentation.rank.name}</span>}
          {prize.shipping_only === true && <span className="prize-tier prize-tier--note">配送のみ・コイン交換不可</span>}
        </div>
        <h3 className="prize-row__name">{name}{count > 1 && <span className="prize-row__count">{" "}× {number.format(count)}</span>}</h3>
        <p className="prize-row__meta">
          <span>獲得日 <b><time dateTime={prize.acquired_at}>{formatPrizeDate(prize.acquired_at)}</time></b></span>
          {prizeStatusFilter(prize) === "stored" && <span>保管期限 <b><time dateTime={prize.storage_expires_at}>{formatPrizeDate(prize.storage_expires_at)}</time></b></span>}
        </p>
        {note && <p className="prize-row__note">{note}</p>}
        {extraNote && <p className="prize-row__note prize-row__note--reason">{extraNote}</p>}
      </div>
      <div className="prize-row__coin">
        <small>{done ? "受け取り" : "コイン交換"}</small>
        <strong>{number.format(totalPoints ?? prize.exchange_points)}</strong>
      </div>
    </article>
  );
}

export function PrizeStatusFilters({
  counts,
  onChange,
  options,
  value,
}: {
  readonly counts: Readonly<Record<string, number>>;
  readonly onChange: (value: string) => void;
  readonly options: readonly { readonly key: string; readonly label: string }[];
  readonly value: string;
}) {
  return (
    <div aria-label="状態で絞り込む" className="prize-filters" role="group">
      {options.map((option) => (
        <button aria-pressed={value === option.key} key={option.key} onClick={() => onChange(option.key)} type="button">
          {option.label}<span className="prize-filters__count">{number.format(counts[option.key] ?? 0)}</span>
        </button>
      ))}
    </div>
  );
}
