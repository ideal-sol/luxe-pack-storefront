"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  isSameShippingAddress,
  ShippingAddressFields,
  ShippingAddressMaskedPresentation,
  toShippingAddressInput,
} from "@/components/address/shipping-address-fields";
import {
  createFulfillmentIdempotencyKey,
  presentFulfillmentProblem,
  type PrizeExchangeResponse,
  type PrizeFulfillmentAdapter,
  type ShippingAddressCollection,
  type ShippingAddressInput,
  type ShippingRequestSummary,
  type UserPrize,
} from "@/lib/platform";
export type FulfillmentAction = "point_exchange" | "shipping";

interface FulfillmentDialogProps {
  readonly action: FulfillmentAction | null;
  readonly client: PrizeFulfillmentAdapter;
  readonly onClose: () => void;
  readonly onReconcile: () => Promise<void>;
  readonly onSmsVerificationRequired: () => void;
  readonly selectedItems: readonly UserPrize[];
}

type AddressSummary = ShippingAddressCollection["items"][number];

const number = new Intl.NumberFormat("ja-JP");

export function PrizeFulfillmentDialog({
  action,
  client,
  onClose,
  onReconcile,
  onSmsVerificationRequired,
  selectedItems,
}: FulfillmentDialogProps) {
  const titleId = useId();
  const [addresses, setAddresses] = useState<readonly AddressSummary[] | null>(null);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressInput, setAddressInput] = useState<ShippingAddressInput | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Readonly<Record<string, readonly string[]>>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const pendingExchange = useRef<string | null>(null);
  const pendingShipping = useRef<string | null>(null);

  const handleShippingProblem = useCallback((error: unknown) => {
    const presented = presentFulfillmentProblem(error);
    if (presented.smsVerificationRequired) {
      onSmsVerificationRequired();
      return null;
    }
    return presented;
  }, [onSmsVerificationRequired]);

  const prizeIds = useMemo(() => selectedItems.map((item) => item.id), [selectedItems]);
  const exchangeEstimate = useMemo(
    () => selectedItems.reduce((total, item) => total + item.exchange_points, 0),
    [selectedItems],
  );

  async function refreshAddresses(preferredId?: string) {
    const { data } = await client.listShippingAddresses();
    setAddresses(data.items);
    setSelectedAddressId((current) => {
      const candidate = preferredId ?? current;
      if (candidate && data.items.some((item) => item.id === candidate)) return candidate;
      return data.items[0]?.id ?? null;
    });
  }

  useEffect(() => {
    if (action !== "shipping") return;
    let active = true;
    void Promise.resolve()
      .then(() => {
        if (!active) return null;
        setAddressesLoading(true);
        setAddresses(null);
        setProblem(null);
        return client.listShippingAddresses();
      })
      .then((response) => {
        if (!response) return;
        const { data } = response;
        if (!active) return;
        setAddresses(data.items);
        setSelectedAddressId(data.items[0]?.id ?? null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        const presented = handleShippingProblem(error);
        if (presented) setProblem(presented.message);
      })
      .finally(() => { if (active) setAddressesLoading(false); });
    return () => { active = false; };
  }, [action, client, handleShippingProblem]);

  function closeDialog() {
    pendingExchange.current = null;
    pendingShipping.current = null;
    submittingRef.current = false;
    setEditingAddressId(null);
    setAddressInput(null);
    setFieldErrors({});
    setProblem(null);
    setSuccess(null);
    setSubmitting(false);
    onClose();
  }

  if (!action) return null;

  async function reconcileReads(shipping?: ShippingRequestSummary) {
    const reads: Promise<unknown>[] = [
      onReconcile(),
      refreshAddresses(),
      client.listShippingRequests(),
    ];
    if (shipping) reads.push(client.getShippingRequest(shipping.id));
    await Promise.all(reads);
  }

  async function exchange() {
    if (submittingRef.current) return;
    const key = pendingExchange.current ?? createFulfillmentIdempotencyKey();
    pendingExchange.current = key;
    submittingRef.current = true;
    setSubmitting(true);
    setProblem(null);
    try {
      const { data } = await client.exchangePrizes(prizeIds, { idempotency_key: key });
      await reconcileReads();
      document.dispatchEvent(new Event("storefront:wallet-refresh"));
      pendingExchange.current = null;
      setSuccess(exchangeSuccess(data));
    } catch (error) {
      const presented = presentFulfillmentProblem(error);
      setFieldErrors(presented.fieldErrors);
      setProblem(presented.message);
      if (!presented.retryable) pendingExchange.current = null;
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function ship() {
    if (!selectedAddressId || submittingRef.current) return;
    const key = pendingShipping.current ?? createFulfillmentIdempotencyKey();
    pendingShipping.current = key;
    submittingRef.current = true;
    setSubmitting(true);
    setProblem(null);
    try {
      const { data } = await client.createShippingRequest(selectedAddressId, prizeIds, { idempotency_key: key });
      await reconcileReads(data);
      pendingShipping.current = null;
      setSuccess(`発送依頼を受け付けました。受付番号: ${data.id}`);
    } catch (error) {
      const presented = handleShippingProblem(error);
      if (!presented) return;
      setProblem(presented.message);
      if (!presented.retryable) pendingShipping.current = null;
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function startEdit(addressId: string) {
    if (submittingRef.current) return;
    setSubmitting(true);
    setProblem(null);
    try {
      const { data } = await client.getShippingAddress(addressId);
      setAddressInput(toShippingAddressInput(data));
      setEditingAddressId(addressId);
    } catch (error) {
      const presented = handleShippingProblem(error);
      if (presented) setProblem(presented.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function saveAddress() {
    if (!editingAddressId || !addressInput || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setProblem(null);
    setFieldErrors({});
    try {
      try {
        await client.updateShippingAddress(editingAddressId, addressInput);
      } catch (error) {
        const presented = presentFulfillmentProblem(error);
        if (!presented.uncertain) throw error;
        const { data } = await client.getShippingAddress(editingAddressId);
        if (!isSameShippingAddress(data, addressInput)) {
          setProblem("更新結果を確認できません。最新のお届け先を確認してから次の操作を行ってください。");
          return;
        }
      }
      setEditingAddressId(null);
      setAddressInput(null);
      await refreshAddresses(editingAddressId);
    } catch (error) {
      const presented = handleShippingProblem(error);
      if (!presented) return;
      setFieldErrors(presented.fieldErrors);
      setProblem(presented.message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function deleteAddress(addressId: string) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setProblem(null);
    try {
      try {
        await client.deleteShippingAddress(addressId);
      } catch (error) {
        const presented = presentFulfillmentProblem(error);
        if (!presented.uncertain) throw error;
        const { data } = await client.listShippingAddresses();
        if (data.items.some((item) => item.id === addressId)) {
          setAddresses(data.items);
          setProblem("削除結果を確認できません。最新のお届け先を確認してから次の操作を行ってください。");
          return;
        }
      }
      setAddresses(null);
      setSelectedAddressId(null);
      await refreshAddresses();
    } catch (error) {
      const presented = handleShippingProblem(error);
      if (presented) setProblem(presented.message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="dialog-backdrop fulfillment-dialog" role="presentation">
      <section aria-labelledby={titleId} aria-modal="true" className="dialog-card fulfillment-dialog__card" role="dialog">
        <p className="dialog-card__eyebrow">FULFILLMENT</p>
        <h2 id={titleId}>{action === "shipping" ? "発送内容を確認" : "コイン交換を確認"}</h2>
        <p>選択した景品: {number.format(selectedItems.length)}件</p>

        {success ? (
          <div className="fulfillment-dialog__success" role="status">
            <strong>手続きが完了しました</strong>
            <p>{success}</p>
            <p>景品・発送・お届け先はPlatformから再取得済みです。</p>
          </div>
        ) : editingAddressId && addressInput ? (
          <form onSubmit={(event) => { event.preventDefault(); void saveAddress(); }}>
            <ShippingAddressFields disabled={submitting} fieldErrors={fieldErrors} onChange={setAddressInput} value={addressInput} />
            {problem && <p className="fulfillment-dialog__error" role="alert">{problem}</p>}
            <div className="dialog-card__actions">
              <button className="button button--ghost" disabled={submitting} onClick={() => { setEditingAddressId(null); setAddressInput(null); }} type="button">戻る</button>
              <button className="button button--dark" disabled={submitting} type="submit">{submitting ? "確認中…" : "お届け先を保存"}</button>
            </div>
          </form>
        ) : (
          <>
            {action === "point_exchange" ? (
              <div className="fulfillment-dialog__summary">
                <span>表示上の交換予定</span>
                <strong>{number.format(exchangeEstimate)} コイン</strong>
                <small>実際の付与コインはPlatformの完了応答を正本とします。</small>
              </div>
            ) : (
              <div className="fulfillment-addresses">
                <div className="fulfillment-addresses__heading">
                  <strong>お届け先</strong>
                </div>
                {addressesLoading ? <p role="status">お届け先を読み込み中…</p> : addresses === null ? null : addresses.length === 0 ? (
                  <div className="fulfillment-addresses__empty">
                    <strong>登録済みのお届け先はありません</strong>
                    <p>発送を依頼する前に、お届け先を登録してください。</p>
                    <Link className="button button--dark" href="/mypage/address">お届け先を登録する</Link>
                  </div>
                ) : (
                  <div className="fulfillment-addresses__list">
                    {addresses.map((address) => (
                      <div className="fulfillment-address" key={address.id}>
                        <label>
                          <input checked={selectedAddressId === address.id} disabled={submitting} name="shipping-address" onChange={() => setSelectedAddressId(address.id)} type="radio" />
                          <ShippingAddressMaskedPresentation address={address} />
                        </label>
                        <div>
                          <button disabled={submitting} onClick={() => void startEdit(address.id)} type="button">編集</button>
                          <button disabled={submitting} onClick={() => void deleteAddress(address.id)} type="button">削除</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {problem && <p className="fulfillment-dialog__error" role="alert">{problem}</p>}
            <div className="dialog-card__actions">
              <button className="button button--ghost" disabled={submitting} onClick={closeDialog} type="button">キャンセル</button>
              <button className="button button--dark" disabled={submitting || action === "shipping" && !selectedAddressId} onClick={() => void (action === "shipping" ? ship() : exchange())} type="button">
                {submitting ? "Platformへ確認中…" : action === "shipping" ? "発送を依頼する" : "コインに交換する"}
              </button>
            </div>
          </>
        )}
        {success && <div className="dialog-card__actions"><button className="button button--dark" onClick={closeDialog} type="button">閉じる</button></div>}
      </section>
    </div>
  );
}

function exchangeSuccess(data: PrizeExchangeResponse) {
  return `${number.format(data.exchanged_count)}件を${number.format(data.exchange_point_total)} コインへ交換しました。`;
}
