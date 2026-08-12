"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  createFulfillmentIdempotencyKey,
  presentFulfillmentProblem,
  type PrizeExchangeResponse,
  type PrizeFulfillmentAdapter,
  type ShippingAddress,
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
  readonly selectedItems: readonly UserPrize[];
}

type AddressSummary = ShippingAddressCollection["items"][number];
type AddressFormMode = { readonly kind: "create" } | { readonly kind: "edit"; readonly id: string };

const emptyAddress: ShippingAddressInput = {
  city: "",
  building: null,
  phone_number: "",
  postal_code: "",
  prefecture: "",
  recipient_name: "",
  street: "",
};
const number = new Intl.NumberFormat("ja-JP");

function addressFingerprint(input: ShippingAddressInput) {
  return JSON.stringify([
    input.recipient_name,
    input.postal_code,
    input.prefecture,
    input.city,
    input.street,
    input.building ?? null,
    input.phone_number,
  ]);
}

function sameAddress(actual: ShippingAddress, expected: ShippingAddressInput) {
  return addressFingerprint(actual) === addressFingerprint(expected);
}

function AddressFields({
  disabled,
  fieldErrors,
  onChange,
  value,
}: {
  readonly disabled: boolean;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
  readonly onChange: (value: ShippingAddressInput) => void;
  readonly value: ShippingAddressInput;
}) {
  function field(
    name: keyof ShippingAddressInput,
    label: string,
    maximum: number,
    inputMode?: "numeric" | "tel",
  ) {
    const current = value[name] ?? "";
    return (
      <label className="form-field">
        <span>{label}</span>
        <input
          disabled={disabled}
          inputMode={inputMode}
          maxLength={maximum}
          onChange={(event) => onChange({ ...value, [name]: event.currentTarget.value || (name === "building" ? null : "") })}
          required={name !== "building"}
          value={current}
        />
        {fieldErrors[name]?.map((message) => <span className="form-field__error" key={message}>{message}</span>)}
      </label>
    );
  }

  return (
    <div className="fulfillment-address-form__fields">
      {field("recipient_name", "お名前", 120)}
      {field("postal_code", "郵便番号", 16, "numeric")}
      {field("prefecture", "都道府県", 32)}
      {field("city", "市区町村", 120)}
      {field("street", "番地", 191)}
      {field("building", "建物名・部屋番号（任意）", 191)}
      {field("phone_number", "電話番号", 32, "tel")}
    </div>
  );
}

export function PrizeFulfillmentDialog({
  action,
  client,
  onClose,
  onReconcile,
  selectedItems,
}: FulfillmentDialogProps) {
  const titleId = useId();
  const [addresses, setAddresses] = useState<readonly AddressSummary[]>([]);
  const [addressesLoading, setAddressesLoading] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [addressMode, setAddressMode] = useState<AddressFormMode | null>(null);
  const [addressInput, setAddressInput] = useState<ShippingAddressInput>(emptyAddress);
  const [fieldErrors, setFieldErrors] = useState<Readonly<Record<string, readonly string[]>>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const pendingExchange = useRef<string | null>(null);
  const pendingShipping = useRef<string | null>(null);
  const pendingAddressCreate = useRef<{ readonly fingerprint: string; readonly key: string } | null>(null);

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
        if (active) setProblem(presentFulfillmentProblem(error).message);
      })
      .finally(() => { if (active) setAddressesLoading(false); });
    return () => { active = false; };
  }, [action, client]);

  function closeDialog() {
    pendingAddressCreate.current = null;
    pendingExchange.current = null;
    pendingShipping.current = null;
    submittingRef.current = false;
    setAddressMode(null);
    setAddressInput(emptyAddress);
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
      const presented = presentFulfillmentProblem(error);
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
      setAddressInput({
        building: data.building ?? null,
        city: data.city,
        phone_number: data.phone_number,
        postal_code: data.postal_code,
        prefecture: data.prefecture,
        recipient_name: data.recipient_name,
        street: data.street,
      });
      setAddressMode({ id: addressId, kind: "edit" });
    } catch (error) {
      setProblem(presentFulfillmentProblem(error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function saveAddress() {
    if (!addressMode || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setProblem(null);
    setFieldErrors({});
    try {
      if (addressMode.kind === "create") {
        const fingerprint = addressFingerprint(addressInput);
        const pending = pendingAddressCreate.current?.fingerprint === fingerprint
          ? pendingAddressCreate.current
          : { fingerprint, key: createFulfillmentIdempotencyKey() };
        pendingAddressCreate.current = pending;
        const { data } = await client.createShippingAddress(addressInput, { idempotency_key: pending.key });
        pendingAddressCreate.current = null;
        await refreshAddresses(data.id);
      } else {
        try {
          await client.updateShippingAddress(addressMode.id, addressInput);
        } catch (error) {
          const presented = presentFulfillmentProblem(error);
          if (!presented.uncertain) throw error;
          const { data } = await client.getShippingAddress(addressMode.id);
          if (!sameAddress(data, addressInput)) {
            setProblem("更新結果を確認できません。最新のお届け先を確認してから次の操作を行ってください。");
            return;
          }
        }
        await refreshAddresses(addressMode.id);
      }
      setAddressMode(null);
      setAddressInput(emptyAddress);
    } catch (error) {
      const presented = presentFulfillmentProblem(error);
      setFieldErrors(presented.fieldErrors);
      setProblem(presented.message);
      if (!presented.retryable) pendingAddressCreate.current = null;
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
      await refreshAddresses();
    } catch (error) {
      setProblem(presentFulfillmentProblem(error).message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <div className="dialog-backdrop fulfillment-dialog" role="presentation">
      <section aria-labelledby={titleId} aria-modal="true" className="dialog-card fulfillment-dialog__card" role="dialog">
        <p className="dialog-card__eyebrow">FULFILLMENT</p>
        <h2 id={titleId}>{action === "shipping" ? "発送内容を確認" : "ポイント交換を確認"}</h2>
        <p>選択した景品: {number.format(selectedItems.length)}件</p>

        {success ? (
          <div className="fulfillment-dialog__success" role="status">
            <strong>手続きが完了しました</strong>
            <p>{success}</p>
            <p>景品・発送・お届け先はPlatformから再取得済みです。</p>
          </div>
        ) : addressMode ? (
          <form onSubmit={(event) => { event.preventDefault(); void saveAddress(); }}>
            <AddressFields disabled={submitting} fieldErrors={fieldErrors} onChange={setAddressInput} value={addressInput} />
            {problem && <p className="fulfillment-dialog__error" role="alert">{problem}</p>}
            <div className="dialog-card__actions">
              <button className="button button--ghost" disabled={submitting} onClick={() => setAddressMode(null)} type="button">戻る</button>
              <button className="button button--dark" disabled={submitting} type="submit">{submitting ? "確認中…" : "お届け先を保存"}</button>
            </div>
          </form>
        ) : (
          <>
            {action === "point_exchange" ? (
              <div className="fulfillment-dialog__summary">
                <span>表示上の交換予定</span>
                <strong>{number.format(exchangeEstimate)}pt</strong>
                <small>実際の付与ポイントはPlatformの完了応答を正本とします。</small>
              </div>
            ) : (
              <div className="fulfillment-addresses">
                <div className="fulfillment-addresses__heading">
                  <strong>お届け先</strong>
                  <button className="button button--ghost button--compact" disabled={submitting} onClick={() => { setAddressInput(emptyAddress); setFieldErrors({}); setProblem(null); setAddressMode({ kind: "create" }); }} type="button">新しいお届け先</button>
                </div>
                {addressesLoading ? <p role="status">お届け先を読み込み中…</p> : addresses.length === 0 ? <p>登録済みのお届け先はありません。</p> : (
                  <div className="fulfillment-addresses__list">
                    {addresses.map((address) => (
                      <div className="fulfillment-address" key={address.id}>
                        <label>
                          <input checked={selectedAddressId === address.id} disabled={submitting} name="shipping-address" onChange={() => setSelectedAddressId(address.id)} type="radio" />
                          <span><strong>{address.recipient_name_masked}</strong><small>{address.postal_code_masked}／{address.phone_number_masked}</small></span>
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
                {submitting ? "Platformへ確認中…" : action === "shipping" ? "発送を依頼する" : "ポイントに交換する"}
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
  return `${number.format(data.exchanged_count)}件を${number.format(data.exchange_point_total)}ptへ交換しました。`;
}
