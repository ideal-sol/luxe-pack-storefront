import type { GachaPresentationState, GachaSaleState } from "@/lib/platform";

export const gachaSaleStateLabels = {
  coming_soon: "販売開始前",
  ended: "販売終了",
  on_sale: "販売中",
  sold_out: "完売",
} as const satisfies Readonly<Record<GachaSaleState, string>>;

export const gachaPresentationReasonLabels = {
  audience_not_eligible: "このガチャの対象条件を満たしていません。",
  authentication_required: "抽選するにはログインが必要です。",
  daily_limit_reached: "本日の抽選上限に達しています。",
  sale_ended: "このガチャの販売は終了しました。",
  sale_not_started: "このガチャはまだ販売開始前です。",
  sold_out: "このガチャは完売しました。",
} as const satisfies Readonly<
  Record<NonNullable<GachaPresentationState["ineligible_reason"]>, string>
>;
