"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/components/auth/session-provider";
import { SmsVerificationRequiredDialog } from "@/components/account/sms-verification-required-dialog";
import { CatalogLoading } from "@/components/catalog/catalog-message";
import { useOptionalPrizeClient } from "@/components/prizes/prize-client-provider";
import { PrizeFulfillmentDialog } from "@/components/prizes/prize-fulfillment";
import { actionablePrizes, type FulfillmentAction } from "@/components/prizes/prize-actions";
import { shippingRequirement } from "@/components/prizes/shipping-minimum";
import { presentPlatformProblem, presentSmsProblem, type DrawResponse, type UserPrize } from "@/lib/platform";
import { PrizeRow } from "@/components/prizes/prize-row";

/**
 * 抽選結果の画面で、今回当たった景品をそのまま「コインに交換」「発送依頼」できる一覧（2026-10-31 要望。オリパワン寄せ）。
 * - 獲得アイテム（/mypage/prizes）の画面と部品には手を入れず、交換・発送の確認画面（PrizeFulfillmentDialog）を共用する。
 * - 景品は /me/prizes を新しい順に読み、今回の抽選結果（draw_result_id）に当たるものを**すべて**拾ってから並べる
 *   （並べ替えを今回の全件に効かせるため。1000連でも、表示していない景品に高いものが残らない）。
 * - 表示は DRAW_FULFILLMENT_PAGE_SIZE（100）件ずつ。「さらに表示」で続きを出す（読み込みは済んでいる）。
 * - 選択できるのは表示中の景品だけ。最初は何も選ばない。表示していない景品が勝手に交換・発送されることはない。
 */
export const DRAW_FULFILLMENT_PAGE_SIZE = 100;
/** 交換・発送は1回に100件まで（Platform の INVALID_PRIZE_SELECTION）。選択もこの件数までにする */
export const DRAW_FULFILLMENT_MAX_SELECTION = 100;
/** 1回の読み込みで /me/prizes を呼ぶ上限（今回の抽選より十分古い景品まで来たら、そこで止める） */
const MAX_REQUESTS_PER_LOAD = 150;
/** 今回の抽選より、この時間以上古い景品だけのページが来たら、それ以上は探さない */
const OLDER_THAN_DRAW_MS = 10 * 60 * 1000;

type SortOrder = "desc" | "asc";

type ListState =
  | { readonly status: "loading"; readonly loaded: number }
  | { readonly status: "error"; readonly message: string }
  | { readonly status: "ready"; readonly items: readonly UserPrize[] };

const number = new Intl.NumberFormat("ja-JP");


export function useDrawResultFulfillmentAvailable(result: DrawResponse): boolean {
  const client = useOptionalPrizeClient()?.client ?? null;
  const { state } = useSession();
  const ids = drawPrizeResultIds(result);
  return client !== null && ids !== null && ids.size > 0 && state.status === "authenticated";
}

export function drawPrizeResultIds(result: DrawResponse): ReadonlySet<string> | null {
  if (!result.results) return null;
  return new Set(result.results.filter((item) => item.result_type === "prize").map((item) => item.id));
}

interface ScanResult {
  readonly matched: readonly UserPrize[];
  readonly cursor: string | null;
  readonly exhausted: boolean;
}

/** /me/prizes を cursor から読み進め、今回の抽選の景品を target 件まで集める。 */
async function scanPrizes(
  listPrizes: (cursor?: string) => Promise<{ readonly data: { readonly items: readonly UserPrize[]; readonly next_cursor: string | null } }>,
  resultIds: ReadonlySet<string>,
  drawCreatedAt: string,
  start: { readonly cursor: string | null; readonly alreadyMatched: number },
  target: number,
  onProgress?: (matched: number) => void,
): Promise<ScanResult> {
  const matched: UserPrize[] = [];
  const seen = new Set<string>();
  const oldestRelevant = new Date(drawCreatedAt).getTime() - OLDER_THAN_DRAW_MS;
  let cursor = start.cursor;
  let first = start.cursor === null && start.alreadyMatched === 0;
  for (let request = 0; request < MAX_REQUESTS_PER_LOAD; request += 1) {
    if (!first && cursor === null) return { matched, cursor: null, exhausted: true };
    first = false;
    const { data } = await listPrizes(cursor ?? undefined);
    for (const item of data.items) {
      if (resultIds.has(item.draw_result_id) && !seen.has(item.id)) {
        matched.push(item);
        seen.add(item.id);
      }
    }
    cursor = data.next_cursor;
    const total = start.alreadyMatched + matched.length;
    onProgress?.(total);
    const pageOlder = data.items.length > 0 && data.items.every((item) => new Date(item.acquired_at).getTime() < oldestRelevant);
    if (total >= resultIds.size || cursor === null || pageOlder) return { matched, cursor, exhausted: true };
    if (matched.length >= target) return { matched, cursor, exhausted: false };
  }
  throw new Error("今回の景品の取得が上限に達しました。獲得アイテムからご確認ください。");
}

interface PrizeGroup {
  readonly key: string;
  readonly items: readonly UserPrize[];
  readonly first: UserPrize;
  readonly points: number;
  readonly selectable: boolean;
}

/** 同じ景品（景品・状態・交換コイン・等級が同じもの）を1行にまとめる（デザイン 2026-10-31「10コイン × 6」）。 */
export function groupPrizes(items: readonly UserPrize[]): readonly PrizeGroup[] {
  const groups = new Map<string, UserPrize[]>();
  for (const item of items) {
    const selectable = item.allowed_actions?.selection.allowed === true;
    const key = JSON.stringify([item.presentation?.prize_id ?? item.id, item.presentation?.rank?.id ?? "", item.exchange_points, item.status, selectable, item.shipping_only === true, item.allowed_actions, item.acquired_at, item.storage_expires_at]);
    const list = groups.get(key);
    if (list) list.push(item); else groups.set(key, [item]);
  }
  return [...groups.entries()].map(([key, list]) => ({
    first: list[0]!,
    items: list,
    key,
    points: list.reduce((sum, item) => sum + item.exchange_points, 0),
    selectable: list[0]!.allowed_actions?.selection.allowed === true,
  }));
}

interface DrawResultFulfillmentProps {
  readonly backHref: string;
  readonly onExchanged: () => void;
  readonly onRemainingChange?: (remaining: number) => void;
  readonly result: DrawResponse;
}

export function DrawResultFulfillment(props: DrawResultFulfillmentProps) {
  const { state } = useSession();
  if (state.status !== "authenticated" || !state.session.user?.id) return null;
  return <DrawResultFulfillmentContent key={`${state.session.user.id}:${props.result.id}`} {...props} />;
}

function DrawResultFulfillmentContent({
  backHref,
  onExchanged,
  onRemainingChange,
  result,
}: DrawResultFulfillmentProps) {
  const { getSmsVerificationStatus, state: session } = useSession();
  const client = useOptionalPrizeClient()?.client ?? null;
  const resultIds = useMemo(() => drawPrizeResultIds(result), [result]);
  const [state, setState] = useState<ListState>({ loaded: 0, status: "loading" });
  const [visibleCount, setVisibleCount] = useState(DRAW_FULFILLMENT_PAGE_SIZE);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [sort, setSort] = useState<SortOrder>("desc");
  const [requestKey, setRequestKey] = useState(0);
  const [action, setAction] = useState<FulfillmentAction | null>(null);
  const [shippingChecking, setShippingChecking] = useState(false);
  const [gateProblem, setGateProblem] = useState<string | null>(null);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [requiredPoints, setRequiredPoints] = useState<bigint | null>(null);
  const actionRef = useRef<FulfillmentAction | null>(null);
  const userId = session.status === "authenticated" ? session.session.user?.id ?? null : null;

  const loadAll = useCallback(async (onProgress?: (matched: number) => void) => {
    if (!client || !resultIds) return [];
    const scan = await scanPrizes((cursor) => client.listPrizes(cursor), resultIds, result.created_at, { cursor: null, alreadyMatched: 0 }, resultIds.size, onProgress);
    return scan.matched;
  }, [client, result.created_at, resultIds]);

  useEffect(() => {
    if (!client || !userId || !resultIds || resultIds.size === 0) return;
    let active = true;
    void loadAll((loaded) => { if (active) setState({ loaded, status: "loading" }); })
      .then((items) => { if (active) setState({ items, status: "ready" }); })
      .catch((error: unknown) => { if (active) setState({ message: presentPlatformProblem(error).message, status: "error" }); });
    return () => { active = false; };
  }, [client, loadAll, requestKey, resultIds, userId]);

  useEffect(() => {
    if (!client) return;
    let active = true;
    const controller = new AbortController();
    void client.shippingPolicyAccess.load(controller.signal)
      .then((policy) => { if (active) setRequiredPoints(shippingRequirement(policy)); })
      .catch(() => { if (active) setRequiredPoints(null); });
    return () => { active = false; controller.abort(); };
  }, [client]);

  /** 交換・発送のあと、今回の景品を読み直す（状態を最新にする）。 */
  const reconcile = useCallback(async () => {
    const items = await loadAll();
    setState({ items, status: "ready" });
    setSelected(new Set());
    if (actionRef.current === "point_exchange") onExchanged();
  }, [loadAll, onExchanged]);

  const items = useMemo(() => {
    if (state.status !== "ready") return [];
    // この画面でコインに交換した景品（交換処理中を含む）は、一覧から消す（2026-10-31 要望）。獲得アイテムの画面には今までどおり残る。
    return state.items.filter((item) => item.status !== "converted" && item.status !== "exchange_processing").sort((a, b) => sort === "desc" ? b.exchange_points - a.exchange_points : a.exchange_points - b.exchange_points);
  }, [sort, state]);
  const groups = useMemo(() => groupPrizes(items), [items]);
  const visibleGroups = useMemo(() => groups.slice(0, visibleCount), [groups, visibleCount]);
  const visibleItems = useMemo(() => visibleGroups.flatMap((group) => group.items), [visibleGroups]);
  const selectedItems = useMemo(() => visibleItems.filter((item) => selected.has(item.id)), [selected, visibleItems]);
  const selectableItems = useMemo(() => visibleItems.filter((item) => item.allowed_actions?.selection.allowed === true), [visibleItems]);
  const remaining = useMemo(() => items.filter((item) => item.allowed_actions?.selection.allowed === true).length, [items]);
  useEffect(() => {
    if (state.status === "ready") onRemainingChange?.(remaining);
  }, [onRemainingChange, remaining, state.status]);
  const selectedPoints = selectedItems.reduce((sum, item) => sum + item.exchange_points, 0);
  const canExchange = actionablePrizes(selectedItems, "point_exchange").length > 0;
  const canShip = actionablePrizes(selectedItems, "shipping").length > 0;

  const start = useCallback(async (next: FulfillmentAction) => {
    actionRef.current = next;
    if (next === "point_exchange") { setAction(next); return; }
    if (shippingChecking) return;
    setShippingChecking(true);
    setGateProblem(null);
    try {
      const sms = await getSmsVerificationStatus();
      if (sms.verified) setAction("shipping");
      else setSmsDialogOpen(true);
    } catch (error) {
      setGateProblem(presentSmsProblem(error).message);
    } finally {
      setShippingChecking(false);
    }
  }, [getSmsVerificationStatus, shippingChecking]);

  const toggleGroup = (group: PrizeGroup, checked: boolean) => setSelected((previous) => {
    const next = new Set(previous);
    if (!checked) { for (const item of group.items) next.delete(item.id); return next; }
    const adding = group.items.filter((item) => !next.has(item.id)).length;
    if (next.size + adding > DRAW_FULFILLMENT_MAX_SELECTION) return previous;
    for (const item of group.items) next.add(item.id);
    return next;
  });
  const selectAll = () => {
    const next = new Set<string>();
    for (const group of visibleGroups) {
      if (!group.selectable || next.size + group.items.length > DRAW_FULFILLMENT_MAX_SELECTION) continue;
      for (const item of group.items) next.add(item.id);
    }
    setSelected(next);
  };

  if (!client || !resultIds || resultIds.size === 0 || session.status !== "authenticated") return null;
  if (state.status === "loading") {
    return resultIds.size > DRAW_FULFILLMENT_PAGE_SIZE
      ? <p aria-live="polite" className="draw-fulfillment__progress" role="status">今回の獲得景品を読み込み中…（{number.format(Math.min(state.loaded, resultIds.size))} / {number.format(resultIds.size)}件）</p>
      : <CatalogLoading label="今回の獲得景品を読み込み中" />;
  }
  if (state.status === "error") {
    return (
      <section aria-labelledby="draw-fulfillment-heading" className="draw-fulfillment">
        <h2 id="draw-fulfillment-heading">今回の獲得景品</h2>
        <p className="draw-fulfillment__problem" role="alert">{state.message}</p>
        <button className="button button--ghost" onClick={() => { setState({ loaded: 0, status: "loading" }); setRequestKey((key) => key + 1); }} type="button">もう一度読み込む</button>
      </section>
    );
  }

  return (
    <section aria-labelledby="draw-fulfillment-heading" className={`draw-fulfillment${remaining > 0 ? "" : " draw-fulfillment--done"}`}>
      <div className="draw-fulfillment__head">
        <div>
          <h2 id="draw-fulfillment-heading">今回の獲得景品</h2>
          <p className="draw-fulfillment__sub">この抽選で出た分だけを表示しています。ここでそのままお手続きいただけます。</p>
        </div>
        <div className="draw-fulfillment__tools">
          <button aria-label={sort === "desc" ? "コインが高い順（押すと低い順）" : "コインが低い順（押すと高い順）"} className="draw-fulfillment__sort" onClick={() => { setSort((value) => value === "desc" ? "asc" : "desc"); setSelected(new Set()); }} type="button">
            {sort === "desc" ? "コインが高い順" : "コインが低い順"}
          </button>
          <Link className="draw-fulfillment__back" href={backHref}>ガチャに戻る</Link>
        </div>
      </div>
      {groups.length === 0 ? (
        <p className="draw-fulfillment__empty">{state.items.length > 0 ? "今回の獲得景品は、すべてコインに交換しました。" : "今回の獲得景品を表示できませんでした。マイページの「獲得アイテム」をご確認ください。"}</p>
      ) : (
        <div className="prize-rows">
          {visibleGroups.map((group) => {
            const checked = group.items.every((item) => selected.has(item.id));
            const fits = selectedItems.length + group.items.filter((item) => !selected.has(item.id)).length <= DRAW_FULFILLMENT_MAX_SELECTION;
            return (
              <PrizeRow
                checked={checked}
                count={group.items.length}
                disabled={!group.selectable || (!checked && !fits)}
                key={group.key}
                onToggle={(next) => toggleGroup(group, next)}
                prize={group.first}
                totalPoints={group.points}
              />
            );
          })}
        </div>
      )}
      {groups.length > visibleGroups.length && (
        <button className="prize-rows__more" onClick={() => setVisibleCount((count) => count + DRAW_FULFILLMENT_PAGE_SIZE)} type="button">
          さらに表示（残り{number.format(groups.length - visibleGroups.length)}件）
        </button>
      )}

      {remaining > 0 && (
        <aside aria-label="選択した景品の操作" className="prize-tray">
          <div className="prize-tray__inner">
            <p className="prize-tray__count"><b>{number.format(selectedItems.length)}</b> 点を選択中</p>
            <p className="prize-tray__amount">コイン交換すると <b>{number.format(selectedPoints)}</b> コイン</p>
            <div className="prize-tray__actions">
              <button className="prize-tray__clear" disabled={selectableItems.length === 0} onClick={selectAll} type="button">全て選択</button>
              <button className="prize-tray__clear" disabled={selectedItems.length === 0} onClick={() => setSelected(new Set())} type="button">選択を解除</button>
              <button className="prize-tray__ship" disabled={!canShip || shippingChecking} onClick={() => void start("shipping")} type="button">{shippingChecking ? "SMS認証を確認中…" : "発送を依頼する"}</button>
              <button className="prize-tray__coin" disabled={!canExchange} onClick={() => void start("point_exchange")} type="button">コインに交換する</button>
            </div>
            {requiredPoints !== null && <small>発送依頼には合計{number.format(Number(requiredPoints))}コイン以上の商品選択が必要です</small>}
            {selectedItems.length >= DRAW_FULFILLMENT_MAX_SELECTION && <small>一度に手続きできるのは{DRAW_FULFILLMENT_MAX_SELECTION}件までです。手続きのあと、残りを選んでください。</small>}
            {groups.length > visibleGroups.length && <small>選択できるのは表示中の景品だけです。</small>}
            {gateProblem && <small role="alert">{gateProblem}</small>}
          </div>
        </aside>
      )}
      <p className="prize-note">発送依頼とコイン交換は、<b>景品ごとに選んで</b>お手続きいただけます。お手続きをなさらない景品は、保管期限まで「獲得アイテム」に保管されます。</p>

      <PrizeFulfillmentDialog
        action={action}
        client={client}
        onClose={() => setAction(null)}
        onReconcile={reconcile}
        onSmsVerificationRequired={() => { setAction(null); setSmsDialogOpen(true); }}
        selectedItems={selectedItems}
      />
      <SmsVerificationRequiredDialog context="shipping" onCancel={() => setSmsDialogOpen(false)} open={smsDialogOpen} />
    </section>
  );
}
