"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@/components/auth/session-provider";
import { SmsVerificationRequiredDialog } from "@/components/account/sms-verification-required-dialog";
import { CatalogLoading, CatalogMessage } from "@/components/catalog/catalog-message";
import { LoginRequiredState } from "@/components/common/state-panel";
import {
  presentPlatformProblem,
  presentSmsProblem,
  type PlatformProblemPresentation,
  type UserPrize,
  type UserPrizeActionUnavailableReason,
} from "@/lib/platform";
import { usePrizeClient } from "./prize-client-provider";
import { PrizeFulfillmentDialog } from "./prize-fulfillment";
import { PrizeRow, PrizeStatusFilters, prizeStatusFilter, type PrizeStatusFilter } from "./prize-row";
import { actionablePrizes, type FulfillmentAction } from "./prize-actions";

type InventoryState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly status: "error"; readonly problem: PlatformProblemPresentation }
  | {
      readonly status: "ready";
      readonly items: readonly UserPrize[];
      readonly nextCursor: string | null;
      readonly loadingMore: boolean;
      readonly sessionUserId: string;
      readonly continuationProblem?: PlatformProblemPresentation;
    };

type BulkAction = FulfillmentAction;

const number = new Intl.NumberFormat("ja-JP");
const reasonLabels: Readonly<Record<UserPrizeActionUnavailableReason, string>> = {
  exchange_points_unavailable: "コイン交換額を確認できません。",
  payment_hold: "お支払い状況の確認中です。",
  status_not_actionable: "現在の状態では選択できません。",
  storage_expired: "保管期限を過ぎています。",
  shipping_only: "配送のみ・コイン交換不可",
};


function selectionReason(prize: UserPrize) {
  const reason = prize.allowed_actions?.selection.unavailable_reason;
  return reason ? reasonLabels[reason] : "この景品は現在選択できません。";
}

function PrizeCard({
  checked,
  onChange,
  prize,
}: {
  readonly checked: boolean;
  readonly onChange: (checked: boolean) => void;
  readonly prize: UserPrize;
}) {
  const selectable = prize.allowed_actions?.selection.allowed === true;
  // 保管中なのに選べないもの（お支払い確認中など）だけ理由を出す。発送依頼済み・交換済みは状態の札と説明で分かる。
  const reason = !selectable && prizeStatusFilter(prize) === "stored" ? selectionReason(prize) : null;
  return <PrizeRow checked={checked} disabled={!selectable} extraNote={reason} onToggle={onChange} prize={prize} />;
}

const statusFilterOptions = [
  { key: "stored", label: "保管中" },
  { key: "shipping", label: "発送依頼済み" },
  { key: "done", label: "コイン交換済み" },
  { key: "all", label: "すべて" },
] as const;

function availableBulkActions(items: readonly UserPrize[], selected: ReadonlySet<string>): readonly BulkAction[] {
  const selectedItems = items.filter((item) => selected.has(item.id));
  if (selectedItems.length === 0) return [];
  return (["point_exchange", "shipping"] as const).filter((action) =>
    actionablePrizes(selectedItems, action).length > 0,
  );
}

function BulkActionTray({ actions, items, onAction, shippingChecking }: { readonly actions: readonly BulkAction[]; readonly items: readonly UserPrize[]; readonly onAction: (action: BulkAction) => void; readonly shippingChecking: boolean }) {
  const count = items.length;
  if (count === 0) return null;
  return (
    <aside aria-label="選択した景品の操作" className="inventory-action-tray">
      <div className="inventory-action-tray__inner">
        <p><strong>{number.format(count)}</strong>件を選択中</p>
        <div>
          {actions.includes("point_exchange") && <button onClick={() => onAction("point_exchange")} type="button">コインに交換</button>}
          {actions.includes("shipping") && <button disabled={shippingChecking} onClick={() => onAction("shipping")} type="button">{shippingChecking ? "SMS認証を確認中…" : "発送を依頼"}</button>}
          {actions.length === 0 && <span>選択中の景品に利用できる操作はありません。</span>}
        </div>
        <small>交換対象: {number.format(actionablePrizes(items, "point_exchange").length)}件 ／ 配送対象: {number.format(actionablePrizes(items, "shipping").length)}件</small>
      </div>
    </aside>
  );
}

export function PrizeInventory() {
  const [filter, setFilter] = useState<PrizeStatusFilter>("all");
  const { getSmsVerificationStatus, state: session } = useSession();
  const { client, configurationAvailable } = usePrizeClient();
  const [requestKey, setRequestKey] = useState(0);
  const [state, setState] = useState<InventoryState>({ status: "idle" });
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [fulfillmentAction, setFulfillmentAction] = useState<FulfillmentAction | null>(null);
  const [shippingChecking, setShippingChecking] = useState(false);
  const [shippingGateProblem, setShippingGateProblem] = useState<string | null>(null);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const sessionUserId = session.status === "authenticated" ? session.session.user?.id ?? null : null;

  useEffect(() => {
    if (!sessionUserId || !client) return;
    let active = true;
    void client.listPrizes()
      .then(({ data }) => {
        if (active) setState({ items: data.items, loadingMore: false, nextCursor: data.next_cursor, sessionUserId, status: "ready" });
      })
      .catch((error: unknown) => {
        if (active) setState({ problem: presentPlatformProblem(error), status: "error" });
      });
    return () => { active = false; };
  }, [client, requestKey, sessionUserId]);

  const visibleItems = useMemo(() => state.status === "ready"
    ? state.items.filter((item) => filter === "all" || prizeStatusFilter(item) === filter)
    : [], [filter, state]);
  const filterCounts = useMemo(() => {
    const counts: Record<PrizeStatusFilter, number> = { all: 0, done: 0, shipping: 0, stored: 0 };
    if (state.status === "ready") for (const item of state.items) { counts.all += 1; counts[prizeStatusFilter(item)] += 1; }
    return counts;
  }, [state]);
  const actions = useMemo(() => state.status === "ready"
    ? availableBulkActions(state.items, selected)
    : [], [selected, state]);
  const selectedItems = useMemo(() => state.status === "ready"
    ? state.items.filter((item) => selected.has(item.id))
    : [], [selected, state]);

  const reconcileInventory = useCallback(async () => {
    if (!client || !sessionUserId) return;
    const { data } = await client.listPrizes();
    setState({ items: data.items, loadingMore: false, nextCursor: data.next_cursor, sessionUserId, status: "ready" });
    setSelected(new Set());
  }, [client, sessionUserId]);

  const loadMore = useCallback(async () => {
    if (!client || state.status !== "ready" || !state.nextCursor || state.loadingMore) return;
    const snapshot = state;
    const cursor = state.nextCursor;
    setState({ items: snapshot.items, loadingMore: true, nextCursor: snapshot.nextCursor, sessionUserId: snapshot.sessionUserId, status: "ready" });
    try {
      const { data } = await client.listPrizes(cursor);
      setState({
        items: [...snapshot.items, ...data.items],
        loadingMore: false,
        nextCursor: data.next_cursor,
        sessionUserId: snapshot.sessionUserId,
        status: "ready",
      });
    } catch (error) {
      setState({
        ...snapshot,
        continuationProblem: presentPlatformProblem(error),
        loadingMore: false,
      });
    }
  }, [client, state]);

  const startFulfillment = useCallback(async (action: FulfillmentAction) => {
    if (action === "point_exchange") {
      setFulfillmentAction(action);
      return;
    }
    if (shippingChecking) return;
    setShippingChecking(true);
    setShippingGateProblem(null);
    try {
      const sms = await getSmsVerificationStatus();
      if (sms.verified) {
        setFulfillmentAction("shipping");
      } else {
        setSmsDialogOpen(true);
      }
    } catch (error) {
      setShippingGateProblem(presentSmsProblem(error).message);
    } finally {
      setShippingChecking(false);
    }
  }, [getSmsVerificationStatus, shippingChecking]);

  const requireSmsVerification = useCallback(() => {
    setFulfillmentAction(null);
    setSmsDialogOpen(true);
  }, []);

  if (session.status === "loading" || state.status === "idle" && session.status === "authenticated" && configurationAvailable) {
    return <CatalogLoading label="獲得景品を読み込み中" />;
  }
  if (session.status === "unauthenticated" || session.status === "session-expired") return <LoginRequiredState />;
  if (session.status === "configuration-unavailable" || !configurationAvailable) {
    return <CatalogMessage description="この環境では景品情報への接続が設定されていません。" eyebrow="CONFIGURATION" title="獲得景品を表示できません" />;
  }
  if (session.status === "error") {
    return <CatalogMessage description="Sessionを確認できませんでした。時間をおいて再度お試しください。" eyebrow="ERROR" title="獲得景品を表示できません" tone="error" />;
  }
  if (state.status === "loading" || state.status === "idle" || state.status === "ready" && state.sessionUserId !== sessionUserId) {
    return <CatalogLoading label="獲得景品を読み込み中" />;
  }
  if (state.status === "error") {
    return <CatalogMessage action={() => {
      setSelected(new Set());
      setState({ status: "loading" });
      setRequestKey((value) => value + 1);
    }} description={state.problem.message} eyebrow="ERROR" title="獲得景品を取得できませんでした" tone="error" />;
  }
  if (state.items.length === 0) {
    return <CatalogMessage description="現在表示できる獲得景品はありません。" eyebrow="EMPTY" title="獲得景品はありません" />;
  }

  return (
    <section aria-labelledby="inventory-heading" className="inventory">
      <div className="inventory__toolbar">
        <div>
          <p>PRIZE INVENTORY</p>
          <h2 id="inventory-heading">保有景品</h2>
          <p className="inventory__status-note">各景品の状態は、最新の受付状況を表示しています。</p>
        </div>
        <PrizeStatusFilters counts={filterCounts} onChange={(value) => { setFilter(value as PrizeStatusFilter); setSelected(new Set()); }} options={statusFilterOptions} value={filter} />
      </div>
      <p className="prize-legend">
        <span><i style={{ background: "#157A4C" }} />保管中 … 発送依頼とコイン交換ができます</span>
        <span><i style={{ background: "#2A4FA8" }} />発送依頼済み … 受付が済み、発送をお待ちいただいています</span>
        <span><i style={{ background: "#6B7B7C" }} />コイン交換済み … コインでお受け取り済みです</span>
      </p>
      <div className="inventory__selection-bar">
        <div className="inventory__selection-actions">
          {(["point_exchange", "shipping"] as const).map((action) => {
            const ids = actionablePrizes(visibleItems, action).map((item) => item.id);
            return (
              <button disabled={ids.length === 0} key={action} onClick={() => setSelected(new Set(ids))} type="button">
                {action === "point_exchange" ? "コイン交換対象を全選択" : "配送対象を全選択"}
              </button>
            );
          })}
          <button disabled={selected.size === 0} onClick={() => setSelected(new Set())} type="button">リセット</button>
        </div>
      </div>
      <div className="inventory__list prize-rows">
        {visibleItems.length === 0 && <p className="inventory__filter-empty">この状態の景品はありません。</p>}
        {visibleItems.map((prize) => (
          <PrizeCard
            checked={selected.has(prize.id)}
            key={prize.id}
            onChange={(checked) => setSelected((current) => {
              const next = new Set(current);
              if (checked) next.add(prize.id); else next.delete(prize.id);
              return next;
            })}
            prize={prize}
          />
        ))}
      </div>
      {state.continuationProblem && <p className="inventory__continuation-error">{state.continuationProblem.message}</p>}
      {shippingGateProblem && <p className="inventory__continuation-error" role="alert">{shippingGateProblem}</p>}
      {state.nextCursor && (
        <button className="button button--ghost inventory__more" disabled={state.loadingMore} onClick={() => void loadMore()} type="button">
          {state.loadingMore ? "読み込み中" : "さらに表示"}
        </button>
      )}
      <BulkActionTray actions={actions} items={selectedItems} onAction={(action) => void startFulfillment(action)} shippingChecking={shippingChecking} />
      {client && (
        <PrizeFulfillmentDialog
          action={fulfillmentAction}
          client={client}
          onClose={() => setFulfillmentAction(null)}
          onReconcile={reconcileInventory}
          onSmsVerificationRequired={requireSmsVerification}
          selectedItems={selectedItems}
        />
      )}
      <SmsVerificationRequiredDialog context="shipping" onCancel={() => setSmsDialogOpen(false)} open={smsDialogOpen} />
    </section>
  );
}
