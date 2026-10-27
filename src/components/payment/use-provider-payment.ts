"use client";

import { ApiProblemError } from "@oripa/storefront-client";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPaymentIdempotencyKey } from "@/lib/platform";
import {
  PAYMENT_UI_PENDING, PAYMENT_UI_UNAVAILABLE, recordUiEvent, supportedPaymentMethod,
  type PaymentMethodOption, type PaymentUiGateway, type UiPayment,
} from "@/lib/platform/payment-ui-gateway";
import { beginPaymentAttempt, finishPaymentAttempt, identifyPaymentAttempt, readPaymentAttempt } from "./payment-attempt";
import { dispatchProviderAction, paymentThanksRoute, postProviderForm, validateInlineForm } from "./provider-payment-actions";
import type { InlineSession, PaymentProviderSdk } from "./provider-payment-sdk";

type FlowState = { busy: boolean; locked: boolean; error: string | null; message: string | null };
const idle: FlowState = { busy: false, locked: false, error: null, message: null };
const failedCard = "カードがご利用いただけませんでした。カード情報をご確認いただくか、別のお支払い方法をお選びください";
const rejectedPaidy = "あと払い（ペイディ）をご利用いただけませんでした。別のお支払い方法をお選びください";

export function useProviderPayment({ gateway, sdk, option, productId, subject, eligible }: {
  gateway: PaymentUiGateway | null; sdk: PaymentProviderSdk; option: PaymentMethodOption | undefined;
  productId: string; subject: string; eligible: boolean;
}) {
  const [state, setState] = useState<FlowState>(idle);
  const [valid, setValid] = useState(false);
  const [mounted, setMounted] = useState(false);
  const target = useRef<HTMLDivElement>(null);
  const inline = useRef<InlineSession | null>(null);
  const running = useRef(false);
  const uncertain = useRef(false);
  const lifecycle = useRef<AbortController | null>(null);
  const checkout = useRef<{ dispose(): void } | null>(null);
  const attachTarget = useCallback((node: HTMLDivElement | null) => { target.current = node; }, []);

  useEffect(() => {
    const controller = new AbortController();
    lifecycle.current = controller;
    let session: InlineSession | null = null;
    void Promise.resolve().then(async () => {
      if (controller.signal.aborted) return;
      setState(idle); setValid(false); setMounted(false);
      running.current = false;
      if (!gateway || !option) { uncertain.current = false; return; }
      try {
        const attempt = readPaymentAttempt(subject);
        uncertain.current = Boolean(attempt);
        if (attempt) {
          setState({ ...idle, locked: true, message: PAYMENT_UI_PENDING });
          if (attempt.paymentId) {
            void gateway.getPayment(attempt.paymentId).then(({ data }) => {
              if (controller.signal.aborted || data.id !== attempt.paymentId ||
                  data.point_product_id && data.point_product_id !== attempt.productId) return;
              if (["succeeded", "failed", "canceled", "expired"].includes(data.status)) {
                finishPaymentAttempt(subject, attempt.idempotencyKey);
                uncertain.current = false;
                setState(idle);
              }
            }).catch(() => { /* Keep the unresolved operation locked. */ });
          }
        }
        if (option?.flow === "inline_card_form" && option.available && gateway) {
          if (!option.inline_form || !target.current) throw new Error(PAYMENT_UI_UNAVAILABLE);
          validateInlineForm(option.inline_form);
          session = await sdk.mountInline(option.inline_form, target.current, value => {
            if (!controller.signal.aborted) setValid(value);
          }, controller.signal);
          if (controller.signal.aborted) { session.dispose(); return; }
          inline.current = session;
          setMounted(true);
        }
      } catch {
        if (!controller.signal.aborted) setState({ ...idle, locked: true, error: PAYMENT_UI_UNAVAILABLE });
      }
    });
    return () => {
      controller.abort();
      session?.dispose();
      inline.current = null;
      checkout.current?.dispose(); checkout.current = null;
    };
  }, [gateway, option, productId, sdk, subject]);

  const checkValidity = useCallback(async () => {
    const controller = lifecycle.current;
    if (!inline.current || !controller || running.current) return;
    try {
      const result = await inline.current.validate();
      if (!controller.signal.aborted) setValid(result);
    } catch { if (!controller.signal.aborted) setValid(false); }
  }, []);

  const submit = async () => {
    const controller = lifecycle.current;
    if (!gateway || !controller || controller.signal.aborted || !option?.available || !supportedPaymentMethod(option) ||
        !eligible || running.current || uncertain.current || state.locked ||
        option.flow === "inline_card_form" && (!inline.current || !mounted || !valid)) return;
    const method = option.method;
    if (method !== "credit_card" && method !== "paidy" && method !== "netridecash") return;
    running.current = true;
    const key = createPaymentIdempotencyKey();
    let created = false;
    let begun = false;
    let sdkSubmitted = false;
    let createdPayment: UiPayment | null = null;
    let callbackClaimed = false;
    const active = () => !controller.signal.aborted;
    const release = (error: string | null) => {
      checkout.current?.dispose(); checkout.current = null;
      try { finishPaymentAttempt(subject, key); } catch {
        uncertain.current = true;
        if (active()) setState({ ...idle, locked: true, message: PAYMENT_UI_PENDING });
        return;
      }
      uncertain.current = false; running.current = false;
      if (active()) setState({ ...idle, error });
    };
    const pending = () => {
      uncertain.current = true;
      if (active()) setState({ ...idle, locked: true, message: PAYMENT_UI_PENDING });
    };
    const thanks = (payment: UiPayment) => {
      if (active()) window.location.replace(paymentThanksRoute(payment.id));
    };
    try {
      beginPaymentAttempt(subject, { productId, idempotencyKey: key, paymentId: null });
      begun = true;
      setState({ busy: true, locked: false, error: null, message: method === "credit_card" ? "お支払いを処理しています" : "決済画面へ移動しています" });
      const { data: payment } = await gateway.startPayment({ payment_method: method, point_product_id: productId }, { idempotency_key: key, signal: controller.signal });
      created = true;
      createdPayment = payment;
      identifyPaymentAttempt(subject, key, payment.id);
      if (!active()) return;
      if (payment.method !== method || payment.point_product_id && payment.point_product_id !== productId || payment.amount.currency !== "JPY") throw new Error(PAYMENT_UI_UNAVAILABLE);
      if (["succeeded", "failed", "canceled", "expired"].includes(payment.status)) {
        finishPaymentAttempt(subject, key); thanks(payment); return;
      }
      if (payment.status === "processing") { pending(); thanks(payment); return; }
      const action = dispatchProviderAction(payment, option.flow);
      switch (action.type) {
        case "form_post":
          await recordUiEvent(gateway, payment.id, { type: "redirect_started" });
          if (active()) postProviderForm(action.action);
          return;
        case "univapay_inline": {
          if (!inline.current || !option.inline_form) throw new Error(PAYMENT_UI_UNAVAILABLE);
          if (option.inline_form.options.amount !== action.action.amount || payment.amount.amount !== action.action.amount) {
            setState({ ...idle, locked: true, error: "金額が変わりました。画面を読み込み直してください" });
            return;
          }
          await inline.current.update(action.action.update, { forceUpdate: true });
          if (!active()) return;
          await recordUiEvent(gateway, payment.id, { type: "inline_submitted" });
          if (!active()) return;
          sdkSubmitted = true;
          const result = await inline.current.submit();
          if (!active()) return;
          if (result.result === "failed") {
            void recordUiEvent(gateway, payment.id, { type: "inline_result", detail: { result: "error" } });
            release(failedCard); return;
          }
          if (result.result === "reported" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result.charge_id)) {
            void recordUiEvent(gateway, payment.id, { type: "inline_result", detail: { result: "success", charge_id: result.charge_id } });
            await gateway.reportUnivapayCharge(payment.id, { charge_id: result.charge_id }, { signal: controller.signal });
            if (!active()) return;
          }
          // No raw SDK Promise/event parser: unknown results wait for Webhook/GET.
          pending(); thanks(payment); return;
        }
        case "paidy_checkout": {
          void recordUiEvent(gateway, payment.id, { type: "paidy_checkout_opened" });
          const confirmKey = createPaymentIdempotencyKey();
          const instance = await sdk.openPaidy(action.action, response => {
            if (!active() || callbackClaimed) return;
            callbackClaimed = true;
            const r = response && typeof response === "object" ? response as Record<string, unknown> : {};
            const status = typeof r.status === "string" ? r.status.toLowerCase() : "unknown";
            if (status === "closed" || status === "rejected") {
              void recordUiEvent(gateway, payment.id, { type: "paidy_checkout_result", detail: { result: status } });
              release(status === "rejected" ? rejectedPaidy : null);
              return;
            }
            pending();
            if (status === "authorized" && typeof r.id === "string" && /^pay_[A-Za-z0-9_-]{1,124}$/.test(r.id)) {
              void recordUiEvent(gateway, payment.id, { type: "paidy_checkout_result", detail: { result: "authorized" } });
              setState({ busy: true, locked: true, error: null, message: "お支払いを確認しています" });
              void gateway.confirmPaidyAuthorization(payment.id, { paidy_payment_id: r.id }, { idempotency_key: confirmKey, signal: controller.signal })
                .then(() => { if (active()) thanks(payment); })
                .catch(() => { if (active()) { pending(); thanks(payment); } });
            } else {
              void gateway.getPayment(payment.id).catch(() => undefined).finally(() => { if (active()) thanks(payment); });
            }
          }, controller.signal);
          if (!active() || callbackClaimed) instance.dispose();
          else {
            checkout.current = instance;
            // Provider overlay owns focus and input; site overlay is removed.
            if (!callbackClaimed) setState({ busy: true, locked: true, error: null, message: null });
          }
          return;
        }
        case "redirect":
          await recordUiEvent(gateway, payment.id, { type: "redirect_started" });
          if (active()) window.location.assign(action.url);
      }
    } catch (reason) {
      if (!active()) return;
      if (begun && !created && reason instanceof ApiProblemError && reason.status >= 400 && reason.status < 500 && ![408, 409, 429].includes(reason.status)) {
        release(PAYMENT_UI_UNAVAILABLE);
      } else {
        pending();
        if (sdkSubmitted && createdPayment) { thanks(createdPayment); return; }
        if (!sdkSubmitted) setState({ ...idle, locked: true, error: PAYMENT_UI_UNAVAILABLE, message: PAYMENT_UI_PENDING });
      }
    }
  };
  return { ...state, attachTarget, valid, mounted, checkValidity, submit };
}
