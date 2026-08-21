"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "@/components/auth/session-provider";
import { CatalogLoading, CatalogMessage } from "@/components/catalog/catalog-message";
import { LoginRequiredState } from "@/components/common/state-panel";
import {
  createFulfillmentIdempotencyKey,
  presentFulfillmentProblem,
  type ShippingAddressInput,
} from "@/lib/platform";
import { usePrizeClient } from "@/components/prizes/prize-client-provider";
import {
  emptyShippingAddress,
  isSameShippingAddress,
  ShippingAddressFields,
  ShippingAddressMaskedPresentation,
  shippingAddressFingerprint,
  type ShippingAddressSummary,
  toShippingAddressInput,
} from "./shipping-address-fields";

type AddressMode = { readonly kind: "create" } | { readonly id: string; readonly kind: "edit" };
type AddressState =
  | { readonly status: "idle" }
  | { readonly status: "loading" }
  | { readonly message: string; readonly status: "error" }
  | { readonly items: readonly ShippingAddressSummary[]; readonly sessionUserId: string; readonly status: "ready" };

export function ShippingAddressManager() {
  const { state: session } = useSession();
  const { client, configurationAvailable } = usePrizeClient();
  const [state, setState] = useState<AddressState>({ status: "idle" });
  const [mode, setMode] = useState<AddressMode | null>(null);
  const [input, setInput] = useState<ShippingAddressInput>(emptyShippingAddress);
  const [fieldErrors, setFieldErrors] = useState<Readonly<Record<string, readonly string[]>>>({});
  const [problem, setProblem] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const pendingCreate = useRef<{ readonly fingerprint: string; readonly key: string } | null>(null);
  const sessionUserId = session.status === "authenticated" ? session.session.user?.id ?? null : null;

  useEffect(() => {
    if (!sessionUserId || !client) return;
    let active = true;
    pendingCreate.current = null;
    void Promise.resolve()
      .then(() => {
        if (!active) return null;
        setMode(null);
        setInput(emptyShippingAddress);
        setFieldErrors({});
        setProblem(null);
        return client.listShippingAddresses();
      })
      .then((response) => {
        if (!response) return;
        const { data } = response;
        if (active) setState({ items: data.items, sessionUserId, status: "ready" });
      })
      .catch((error: unknown) => {
        if (active) setState({ message: presentFulfillmentProblem(error).message, status: "error" });
      });
    return () => { active = false; };
  }, [client, requestKey, sessionUserId]);

  async function refreshAddresses() {
    const currentSessionUserId = sessionUserId;
    if (!client || !currentSessionUserId) return;
    const { data } = await client.listShippingAddresses();
    setState({ items: data.items, sessionUserId: currentSessionUserId, status: "ready" });
  }

  function startCreate() {
    pendingCreate.current = null;
    setInput(emptyShippingAddress);
    setFieldErrors({});
    setProblem(null);
    setMode({ kind: "create" });
  }

  async function startEdit(addressId: string) {
    if (!client || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setProblem(null);
    try {
      const { data } = await client.getShippingAddress(addressId);
      setInput(toShippingAddressInput(data));
      setFieldErrors({});
      setMode({ id: addressId, kind: "edit" });
    } catch (error) {
      setProblem(presentFulfillmentProblem(error).message);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function saveAddress() {
    if (!client || !mode || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setProblem(null);
    setFieldErrors({});
    try {
      if (mode.kind === "create") {
        const fingerprint = shippingAddressFingerprint(input);
        const pending = pendingCreate.current?.fingerprint === fingerprint
          ? pendingCreate.current
          : { fingerprint, key: createFulfillmentIdempotencyKey() };
        pendingCreate.current = pending;
        await client.createShippingAddress(input, { idempotency_key: pending.key });
        pendingCreate.current = null;
      } else {
        try {
          await client.updateShippingAddress(mode.id, input);
        } catch (error) {
          const presented = presentFulfillmentProblem(error);
          if (!presented.uncertain) throw error;
          const { data } = await client.getShippingAddress(mode.id);
          if (!isSameShippingAddress(data, input)) {
            setProblem("更新結果を確認できません。最新のお届け先を確認してから次の操作を行ってください。");
            return;
          }
        }
      }
      setMode(null);
      setInput(emptyShippingAddress);
      try {
        await refreshAddresses();
      } catch {
        setProblem("お届け先を保存しましたが、最新の一覧を取得できませんでした。ページを再読み込みしてください。");
      }
    } catch (error) {
      const presented = presentFulfillmentProblem(error);
      setFieldErrors(presented.fieldErrors);
      setProblem(presented.message);
      if (!presented.retryable) pendingCreate.current = null;
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  async function deleteAddress(addressId: string) {
    const currentSessionUserId = sessionUserId;
    if (!client || !currentSessionUserId || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setProblem(null);
    let deletionCompleted = false;
    try {
      try {
        await client.deleteShippingAddress(addressId);
      } catch (error) {
        const presented = presentFulfillmentProblem(error);
        if (!presented.uncertain) throw error;
        const { data } = await client.listShippingAddresses();
        if (data.items.some((item) => item.id === addressId)) {
          setState({ items: data.items, sessionUserId: currentSessionUserId, status: "ready" });
          setProblem("削除結果を確認できません。最新のお届け先を確認してから次の操作を行ってください。");
          return;
        }
      }
      deletionCompleted = true;
      setState({ status: "loading" });
      await refreshAddresses();
    } catch (error) {
      const presented = presentFulfillmentProblem(error);
      if (deletionCompleted) {
        setState({ message: "お届け先を削除しましたが、最新の一覧を取得できませんでした。再読み込みしてください。", status: "error" });
      } else {
        setProblem(presented.message);
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (session.status === "loading") return <CatalogLoading label="お届け先を読み込み中" />;
  if (session.status === "unauthenticated" || session.status === "session-expired") return <LoginRequiredState />;
  if (session.status === "configuration-unavailable" || !configurationAvailable) {
    return <CatalogMessage description="この環境ではお届け先情報への接続が設定されていません。" eyebrow="CONFIGURATION" title="お届け先を表示できません" />;
  }
  if (session.status === "error") {
    return <CatalogMessage description="Sessionを確認できませんでした。時間をおいて再度お試しください。" eyebrow="ERROR" title="お届け先を表示できません" tone="error" />;
  }
  if (!sessionUserId) return <LoginRequiredState />;
  if (state.status === "idle" || state.status === "loading") {
    return <CatalogLoading label="お届け先を読み込み中" />;
  }
  if (state.status === "error") {
    return <CatalogMessage action={() => {
      setState({ status: "loading" });
      setRequestKey((value) => value + 1);
    }} description={state.message} eyebrow="ERROR" title="お届け先を取得できませんでした" tone="error" />;
  }
  if (state.status !== "ready") return <CatalogLoading label="お届け先を読み込み中" />;
  if (state.sessionUserId !== sessionUserId) return <CatalogLoading label="お届け先を読み込み中" />;

  return (
    <section aria-labelledby="shipping-address-heading" className="shipping-address-manager">
      {mode ? (
        <form className="shipping-address-form" onSubmit={(event) => { event.preventDefault(); void saveAddress(); }}>
          <div className="shipping-address-manager__heading">
            <div>
              <p>SHIPPING ADDRESS</p>
              <h2 id="shipping-address-heading">{mode.kind === "create" ? "新しいお届け先" : "お届け先を編集"}</h2>
            </div>
          </div>
          <ShippingAddressFields disabled={submitting} fieldErrors={fieldErrors} onChange={setInput} value={input} />
          {problem && <p className="fulfillment-dialog__error" role="alert">{problem}</p>}
          <div className="shipping-address-form__actions">
            <button className="button button--ghost" disabled={submitting} onClick={() => { setMode(null); setProblem(null); setFieldErrors({}); }} type="button">一覧へ戻る</button>
            <button className="button button--dark" disabled={submitting} type="submit">{submitting ? "確認中…" : "お届け先を保存"}</button>
          </div>
        </form>
      ) : (
        <div className="shipping-address-list">
          <div className="shipping-address-manager__heading">
            <div>
              <p>REGISTERED ADDRESSES</p>
              <h2 id="shipping-address-heading">登録済み住所</h2>
            </div>
            <button className="button button--dark button--compact" disabled={submitting} onClick={startCreate} type="button">新しいお届け先を登録</button>
          </div>
          {state.items.length === 0 ? (
            <div className="shipping-address-list__empty">
              <strong>登録済みのお届け先はありません</strong>
              <p>景品の配送を依頼する前に、お届け先を登録してください。</p>
            </div>
          ) : (
            <div className="shipping-address-list__items">
              {state.items.map((address) => (
                <article className="shipping-address-card" key={address.id}>
                  <ShippingAddressMaskedPresentation address={address} />
                  <div className="shipping-address-card__actions">
                    <button disabled={submitting} onClick={() => void startEdit(address.id)} type="button">編集</button>
                    <button disabled={submitting} onClick={() => void deleteAddress(address.id)} type="button">削除</button>
                  </div>
                </article>
              ))}
            </div>
          )}
          {problem && <p className="fulfillment-dialog__error" role="alert">{problem}</p>}
        </div>
      )}
    </section>
  );
}
