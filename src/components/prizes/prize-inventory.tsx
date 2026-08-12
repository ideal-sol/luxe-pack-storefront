"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@/components/auth/session-provider";
import { CatalogAsset } from "@/components/catalog/catalog-asset";
import { CatalogLoading, CatalogMessage } from "@/components/catalog/catalog-message";
import { LoginRequiredState } from "@/components/common/state-panel";
import {
  presentPlatformProblem,
  type PlatformProblemPresentation,
  type UserPrize,
  type UserPrizeActionUnavailableReason,
  type UserPrizeStatus,
} from "@/lib/platform";
import { usePrizeClient } from "./prize-client-provider";
import { PrizeFulfillmentDialog, type FulfillmentAction } from "./prize-fulfillment";

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
const statusLabels: Readonly<Record<UserPrizeStatus, string>> = {
  canceled: "取消",
  converted: "ポイント交換済み",
  delivered: "配送完了",
  exchange_processing: "ポイント交換処理中",
  expired: "保管期限終了",
  hold: "保留",
  packing: "梱包中",
  returned: "返送済み",
  return_requested: "返送手続中",
  shipped: "発送済み",
  shipping_requested: "発送依頼済み",
  stored: "保管中",
};
const reasonLabels: Readonly<Record<UserPrizeActionUnavailableReason, string>> = {
  exchange_points_unavailable: "ポイント交換額を確認できません。",
  payment_hold: "お支払い状況の確認中です。",
  status_not_actionable: "現在の状態では選択できません。",
  storage_expired: "保管期限を過ぎています。",
};

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeZone: "Asia/Tokyo",
  }).format(new Date(value));
}

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
  const presentation = prize.presentation;
  const image = presentation?.image?.media_type === "image" ? presentation.image : null;
  const selectable = prize.allowed_actions?.selection.allowed === true;
  const name = presentation?.name ?? "景品情報を表示できません";

  return (
    <article className={`inventory-card${checked ? " inventory-card--selected" : ""}`}>
      <label className="inventory-card__select">
        <input
          aria-label={`${name}を選択`}
          checked={checked}
          disabled={!selectable}
          onChange={(event) => onChange(event.currentTarget.checked)}
          type="checkbox"
        />
        <span aria-hidden="true" />
      </label>
      <div className="inventory-card__image">
        <CatalogAsset
          alt={image?.alt_text ?? name}
          fallbackLabel="PRIZE IMAGE"
          {...(image?.path ? { src: image.path } : {})}
        />
      </div>
      <div className="inventory-card__body">
        <div className="inventory-card__badges">
          <span>{statusLabels[prize.status]}</span>
          {presentation?.rank && <span>{presentation.rank.name}</span>}
        </div>
        <h2>{name}</h2>
        <dl>
          <div><dt>獲得日</dt><dd><time dateTime={prize.acquired_at}>{formatDateTime(prize.acquired_at)}</time></dd></div>
          <div><dt>保管期限</dt><dd><time dateTime={prize.storage_expires_at}>{formatDateTime(prize.storage_expires_at)}</time></dd></div>
          <div><dt>交換ポイント</dt><dd>{number.format(prize.exchange_points)}pt</dd></div>
        </dl>
        {!selectable && <p className="inventory-card__reason">{selectionReason(prize)}</p>}
      </div>
    </article>
  );
}

function availableBulkActions(items: readonly UserPrize[], selected: ReadonlySet<string>): readonly BulkAction[] {
  const selectedItems = items.filter((item) => selected.has(item.id));
  if (selectedItems.length === 0) return [];
  return (["point_exchange", "shipping"] as const).filter((action) =>
    selectedItems.every((item) => item.allowed_actions?.[action].allowed === true),
  );
}

function BulkActionTray({ actions, count, onAction }: { readonly actions: readonly BulkAction[]; readonly count: number; readonly onAction: (action: BulkAction) => void }) {
  if (count === 0) return null;
  return (
    <aside aria-label="選択した景品の操作" className="inventory-action-tray">
      <div className="inventory-action-tray__inner">
        <p><strong>{number.format(count)}</strong>件を選択中</p>
        <div>
          {actions.includes("point_exchange") && <button onClick={() => onAction("point_exchange")} type="button">ポイントに交換</button>}
          {actions.includes("shipping") && <button onClick={() => onAction("shipping")} type="button">発送を依頼</button>}
          {actions.length === 0 && <span>選択中の景品に共通して利用できる操作はありません。</span>}
        </div>
        <small>操作可否と完了結果はPlatformが実行時に再検証します。</small>
      </div>
    </aside>
  );
}

export function PrizeInventory() {
  const { state: session } = useSession();
  const { client, configurationAvailable } = usePrizeClient();
  const [requestKey, setRequestKey] = useState(0);
  const [state, setState] = useState<InventoryState>({ status: "idle" });
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [fulfillmentAction, setFulfillmentAction] = useState<FulfillmentAction | null>(null);
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

  const selectableIds = useMemo(() => state.status === "ready"
    ? state.items.filter((item) => item.allowed_actions?.selection.allowed === true).map((item) => item.id)
    : [], [state]);
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
        </div>
        <div className="inventory__selection-actions">
          <button
            disabled={selectableIds.length === 0 || selectableIds.every((id) => selected.has(id))}
            onClick={() => setSelected(new Set(selectableIds))}
            type="button"
          >
            全て選択
          </button>
          <button disabled={selected.size === 0} onClick={() => setSelected(new Set())} type="button">リセット</button>
        </div>
      </div>
      <p className="inventory__status-note">状態はPlatformから返された値を項目ごとに表示しています。</p>
      <div className="inventory__list">
        {state.items.map((prize) => (
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
      {state.nextCursor && (
        <button className="button button--ghost inventory__more" disabled={state.loadingMore} onClick={() => void loadMore()} type="button">
          {state.loadingMore ? "読み込み中" : "さらに表示"}
        </button>
      )}
      <BulkActionTray actions={actions} count={selected.size} onAction={setFulfillmentAction} />
      {client && (
        <PrizeFulfillmentDialog
          action={fulfillmentAction}
          client={client}
          onClose={() => setFulfillmentAction(null)}
          onReconcile={reconcileInventory}
          selectedItems={selectedItems}
        />
      )}
    </section>
  );
}
