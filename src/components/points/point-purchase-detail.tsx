"use client";

import Link from "next/link";
import { StorefrontTransportError } from "@oripa/storefront-client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@/components/auth/session-provider";
import { MemberAccess } from "@/components/auth/member-access";
import { LoginRequiredState } from "@/components/common/state-panel";
import { CatalogLoading, CatalogMessage } from "@/components/catalog/catalog-message";
import { FincodeCardFields, type FincodeCardFieldsHandle } from "@/components/payment/fincode-card-fields";
import { CardSaveConfirmation } from "@/components/payment/card-save-confirmation";
import {
  assertCardRegistrationResumeAvailable,
  beginCardRegistrationReturn,
  clearCardRegistrationResume,
  markCardRegistrationPaymentStarting,
  readCardRegistrationResume,
  saveCardRegistrationResume,
} from "@/components/payment/card-registration-resume";
import { PaymentMethodSelector } from "@/components/payment/payment-method-selector";
import { PaymentMethodLoader } from "@/components/payment/payment-method-loader";
import { PaymentProcessingOverlay } from "@/components/payment/payment-processing-overlay";
import { useProviderPayment } from "@/components/payment/use-provider-payment";
import { leaveProviderDocument } from "@/components/payment/provider-document";
import { usePaymentReturnEvent } from "@/components/payment/use-payment-return-event";
import { safePaymentRedirect } from "@/components/payment/provider-payment-actions";
import { isLegacyPaymentMethod, isProviderMethod, PAYMENT_UI_UNAVAILABLE, supportedPaymentMethod, type PaymentMethodOption } from "@/lib/platform/payment-ui-gateway";
import { PaymentReturnAlert } from "@/components/payment/payment-return-alert";
import { usePaymentClient } from "@/components/payment/payment-client-provider";
import {
  createPaymentIdempotencyKey,
  isDefinitiveCardRegistrationProblem,
  isUncertainCardRegistrationProblem,
  presentCardRegistrationProblem,
  presentPaymentProblem,
  presentPlatformProblem,
  type Payment,
  type PaymentCard,
  type PaymentCardCollection,
  type PaymentCardRegistration,
  type PaymentCardUiBootstrap,
  type PaymentCreateRequest,
  type PaymentMethod,
  type PlatformProblemPresentation,
  type PointProduct,
  type PointProductCollection,
} from "@/lib/platform";
import { pointPurchaseDetailRoute } from "@/lib/routes/navigation";
import { usePointClient } from "./point-client-provider";
import { useFirstBuyCountdown } from "./use-first-buy-offer";
import {
  pointProductIneligibleReasonLabels,
  pointProductNumber,
  pointProductSaleStateLabels,
  presentCoinTerminology,
} from "./point-purchase-page";

type DetailState =
  | { readonly status: "loading" }
  | { readonly status: "configuration-unavailable" }
  | { readonly status: "session-error" }
  | { readonly status: "error"; readonly problem: PlatformProblemPresentation; readonly productId: string; readonly sessionKey: string }
  | { readonly status: "ready"; readonly collection: PointProductCollection; readonly productId: string; readonly sessionKey: string };

function formatPrice(product: PointProduct) {
  return new Intl.NumberFormat("ja-JP", { currency: product.price.currency, style: "currency" }).format(product.price.amount);
}

function PurchaseSummary({ product }: { readonly product: PointProduct }) {
  const limitedBonus = product.limited_bonus?.state === "active" ? product.limited_bonus.amount : 0;
  const total = product.grant.paid_points + product.grant.bonus_points + limitedBonus;
  return (
    <section aria-labelledby="point-purchase-summary-title" className="point-purchase-detail__summary">
      <header><p>SUMMARY</p><h2 id="point-purchase-summary-title">購入内容</h2></header>
      <dl className="point-purchase-detail__facts">
        <div><dt>支払金額</dt><dd>{formatPrice(product)}</dd></div>
        <div><dt>獲得コイン</dt><dd><strong>{pointProductNumber.format(product.grant.paid_points)}</strong><span>コイン</span></dd></div>
        {product.grant.bonus_points > 0 ? <div><dt>ボーナスコイン</dt><dd><strong>{pointProductNumber.format(product.grant.bonus_points)}</strong><span>コイン</span></dd></div> : null}
        {limitedBonus > 0 ? <div><dt>期間限定ボーナスコイン</dt><dd><strong>{pointProductNumber.format(limitedBonus)}</strong><span>コイン</span></dd></div> : null}
        <div className="point-purchase-detail__total"><dt>合計コイン</dt><dd><strong>{pointProductNumber.format(total)}</strong><span>コイン</span></dd></div>
      </dl>
    </section>
  );
}

function PurchaseForm({
  product,
  registrationId,
  registrationProcessing,
  onRegistrationStopped,
  options,
  subject,
}: {
  readonly product: PointProduct;
  readonly registrationId: string | null;
  readonly registrationProcessing: boolean;
  readonly onRegistrationStopped: () => void;
  readonly options: readonly PaymentMethodOption[];
  readonly subject: string;
}) {
  const { client, uiGateway, providerSdk } = usePaymentClient();
  const cardFieldsRef = useRef<FincodeCardFieldsHandle>(null);
  const [method, setMethod] = useState<string | null>(() => {
    const requested = typeof window === "undefined" ? null : new URL(window.location.href).searchParams.get("payment_method");
    const first = options.find(o => o.method === requested && o.available && supportedPaymentMethod(o)) ?? options.find(o => o.available && supportedPaymentMethod(o));
    // Preserve the explicit fincode selection before reading saved cards.
    return first?.flow === "card_component" ? null : first?.method ?? null;
  });
  const selectedOption = options.find(o => o.method === method);
  const providerMethod = isProviderMethod(selectedOption);
  const cardPolicy = options.find(o => o.method === "credit_card");
  const savedCardsEnabled = cardPolicy?.flow === "card_component" && cardPolicy.saved_cards_enabled;
  const { busy: providerBusy, locked: providerLocked, error: providerError, message: providerMessage, attachTarget, valid: inlineValid, mounted: inlineMounted, providerValidates, checkValidity, submit: submitProvider } = useProviderPayment({ gateway: uiGateway, sdk: providerSdk, option: providerMethod ? selectedOption : undefined,
    productId: product.id, subject, eligible: product.is_available && product.eligible && product.cta.state === "enabled" });
  const submitStartingRef = useRef(false);
  const alive = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const [cards, setCards] = useState<readonly PaymentCard[]>([]);
  const [cardLimits, setCardLimits] = useState<PaymentCardCollection["limits"] | null>(null);
  const [cardsLoaded, setCardsLoaded] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | "new" | null>(null);
  const [bootstrap, setBootstrap] = useState<PaymentCardUiBootstrap | null>(null);
  const [cardMounted, setCardMounted] = useState(false);
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [cardBusy, setCardBusy] = useState(false);
  const [submitting, setSubmitting] = useState(Boolean(registrationId));
  const [submissionLocked, setSubmissionLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const registrationStartingRef = useRef(false);
  const registrationResumeRef = useRef<string | null>(null);
  const onCardMountStateChange = useCallback((mounted: boolean) => setCardMounted(mounted), []);
  const onCardUiError = useCallback((reason: unknown) => {
    setError(presentPaymentProblem(reason).message);
  }, []);

  const refreshCards = useCallback(async () => {
    if (!client || !savedCardsEnabled) return;
    const { data } = await client.listCards();
    if (!alive.current) return;
    setCards(data.data);
    setCardLimits(data.limits);
    setCardsLoaded(true);
    setSelectedCardId((current) => {
      if (current === "new") return current;
      if (current && data.data.some((card) => card.id === current && card.can_pay && !card.is_expired)) return current;
      return data.data.find((card) => card.can_pay && !card.is_expired)?.id ?? null;
    });
  }, [client, savedCardsEnabled]);

  const loadCards = useCallback(() => {
    if (!client || cardBusy) return;
    setCardBusy(true);
    setError(null);
    void refreshCards()
      .catch((reason) => setError(presentPaymentProblem(reason).message))
      .finally(() => setCardBusy(false));
  }, [cardBusy, client, refreshCards]);

  const openNewCard = () => {
    setSelectedCardId("new");
    setBootstrap(null);
    setCardMounted(false);
    setError(null);
    if (!client || cardBusy) return;
    setCardBusy(true);
    void client.getPaymentCardUiBootstrap().then(({ data }) => setBootstrap(data))
      .catch((reason) => setError(presentPaymentProblem(reason).message)).finally(() => setCardBusy(false));
  };

  const navigateAfterStart = useCallback(async (
    payment: Payment,
    paymentMethod: PaymentMethod,
    requireSavedCard3ds = false,
  ) => {
    if (!alive.current) return;
    if (requireSavedCard3ds && ["created", "requires_action"].includes(payment.status) &&
        payment.next_action?.type !== "three_d_secure") {
      throw new Error("Canonical saved-card Payment 3DS action is unavailable");
    }
    if (["processing", "succeeded", "failed", "canceled", "expired"].includes(payment.status)) {
      window.location.replace(`/points/purchase/thanks?pid=${encodeURIComponent(payment.id)}`);
      return;
    }
    if (payment.next_action && !["redirect", "three_d_secure", "fincode_card_component"].includes(payment.next_action.type)) throw new Error(PAYMENT_UI_UNAVAILABLE);
    if (paymentMethod === "konbini" || paymentMethod === "virtual_account") {
      window.location.replace(`/points/purchase/thanks?pid=${encodeURIComponent(payment.id)}`);
      return;
    }
    if (payment.next_action?.type === "fincode_card_component") {
      if (!bootstrap || !cardMounted ||
          payment.next_action.public_api_key !== bootstrap.public_api_key ||
          payment.next_action.is_live_mode !== bootstrap.is_live_mode || payment.next_action.tds_type !== "2") {
        throw new Error("Canonical fincode Card action is unavailable");
      }
      const redirectUrl = await cardFieldsRef.current?.execute(payment.next_action);
      if (!alive.current) return;
      if (redirectUrl) window.location.assign(redirectUrl);
      else window.location.replace(`/points/purchase/thanks?pid=${encodeURIComponent(payment.id)}`);
      return;
    }
    if (payment.next_action?.type === "redirect" || payment.next_action?.type === "three_d_secure") {
      safePaymentRedirect(payment.next_action.url);
      window.location.assign(payment.next_action.url);
      return;
    }
    throw new Error(PAYMENT_UI_UNAVAILABLE);
  }, [bootstrap, cardMounted]);

  const submitPayment = async () => {
    if (!selectedOption?.available || !supportedPaymentMethod(selectedOption) || !product.is_available || !product.eligible || product.cta.state !== "enabled") return;
    if (providerMethod) { await submitProvider(); return; }
    if (!client || !method || !isLegacyPaymentMethod(method) || submitting || cardBusy || submissionLocked || submitStartingRef.current) return;
    if (method === "credit_card" && !savedCardsEnabled) return;
    const newCard = method === "credit_card" && selectedCardId === "new";
    if (method === "credit_card" && (!selectedCardId || newCard && !cardMounted)) return;
    submitStartingRef.current = true;
    const idempotencyKey = createPaymentIdempotencyKey();
    setSubmitting(true);
    setError(null);
    let paymentCreated = false;
    try {
      let card: PaymentCreateRequest["card"];
      if (method === "credit_card" && selectedCardId && selectedCardId !== "new") {
        card = { card_id: selectedCardId, source: "saved" };
      } else if (newCard) {
        card = { save: false, source: "new" };
      }
      const input: PaymentCreateRequest = card
        ? { card, payment_method: method, point_product_id: product.id }
        : { payment_method: method, point_product_id: product.id };
      const { data: payment } = await client.startPayment(input, { idempotency_key: idempotencyKey });
      paymentCreated = true;
      if (!alive.current) return;
      await navigateAfterStart(
        payment,
        method,
        method === "credit_card" && selectedCardId !== "new",
      );
    } catch (reason) {
      if (!alive.current) return;
      setError(presentPaymentProblem(reason, method).message);
      if (paymentCreated || reason instanceof StorefrontTransportError) setSubmissionLocked(true);
      setSubmitting(false);
    } finally {
      submitStartingRef.current = false;
    }
  };

  const startSavedCardPayment = useCallback(async (
    cardId: string,
    idempotencyKey: string,
  ) => {
    if (!client) throw new Error("Canonical Payment Client is unavailable");
    const { data: payment } = await client.startPayment({
      card: { card_id: cardId, source: "saved" },
      payment_method: "credit_card",
      point_product_id: product.id,
    }, { idempotency_key: idempotencyKey });
    return payment;
  }, [client, product.id]);

  const saveAndBuy = async () => {
    if (!product.is_available || !product.eligible || product.cta.state !== "enabled" || !savedCardsEnabled || !selectedOption?.available || registrationStartingRef.current || !client || submitting || cardBusy || submissionLocked || !cardMounted ||
        (cardLimits?.registration_remaining ?? 0) <= 0) return;
    registrationStartingRef.current = true;
    setConfirmationOpen(false);
    setSubmitting(true);
    setError(null);
    let registrationCreated = false;
    let paymentCreated = false;
    let paymentStarting = false;
    let registrationPublicId: string | null = null;
    try {
      assertCardRegistrationResumeAvailable();
      const registrationIdempotencyKey = createPaymentIdempotencyKey();
      const paymentIdempotencyKey = createPaymentIdempotencyKey();
      const cardToken = await cardFieldsRef.current?.tokenize();
      if (!alive.current) return;
      if (!cardToken) throw new Error("Card tokenization did not return a token");
      const { data: registration } = await client.startCardRegistration(
        { card_token: cardToken },
        { idempotency_key: registrationIdempotencyKey },
      );
      registrationCreated = true;
      registrationPublicId = registration.id;
      if (!alive.current) return;
      if (registration.status === "requires_action" && registration.next_action?.type === "three_d_secure") {
        saveCardRegistrationResume({
          paymentIdempotencyKey,
          productId: product.id,
          registrationId: registration.id,
        });
        window.location.assign(registration.next_action.url);
        return;
      }
      if (registration.status === "completed" && registration.saved_card_id) {
        setSelectedCardId(registration.saved_card_id);
        setCardMounted(false);
        saveCardRegistrationResume({
          paymentIdempotencyKey,
          productId: product.id,
          registrationId: registration.id,
        });
        if (!beginCardRegistrationReturn(registration.id, product.id) ||
            !markCardRegistrationPaymentStarting(registration.id)) {
          throw new Error("Card registration Payment correlation is unavailable");
        }
        paymentStarting = true;
        const payment = await startSavedCardPayment(registration.saved_card_id, paymentIdempotencyKey);
        paymentCreated = true;
        void refreshCards().catch(() => undefined);
        await navigateAfterStart(payment, "credit_card", true);
        clearCardRegistrationResume(registration.id);
        return;
      }
      setError(presentCardRegistrationProblem(null).message);
      if (registration.status === "pending" || registration.status === "requires_action") {
        setSubmissionLocked(true);
      }
      setSubmitting(false);
    } catch (reason) {
      const uncertain = paymentStarting
        ? reason instanceof StorefrontTransportError
        : isUncertainCardRegistrationProblem(reason);
      if (paymentStarting && !uncertain && !paymentCreated && registrationPublicId) {
        clearCardRegistrationResume(registrationPublicId);
        void refreshCards().catch(() => undefined);
      }
      setError(paymentStarting
        ? presentPaymentProblem(reason, "credit_card").message
        : presentCardRegistrationProblem(reason).message);
      if (uncertain || paymentCreated || registrationCreated && !paymentStarting) setSubmissionLocked(true);
      setSubmitting(false);
    } finally {
      registrationStartingRef.current = false;
    }
  };

  useEffect(() => {
    if (registrationId) return;
    const timer = window.setTimeout(() => {
      try {
        const context = readCardRegistrationResume();
        if (context?.productId === product.id) setSubmissionLocked(true);
      } catch (reason) {
        setError(presentCardRegistrationProblem(reason).message);
        setSubmissionLocked(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [product.id, registrationId]);

  useEffect(() => {
    const cardPolicy = options.find(o => o.method === "credit_card");
    if (!client || !registrationId || registrationResumeRef.current === registrationId) return;
    if (!cardPolicy?.available || cardPolicy.flow !== "card_component" || !cardPolicy.saved_cards_enabled) {
      const stop = window.setTimeout(() => {
        setError(PAYMENT_UI_UNAVAILABLE); setSubmissionLocked(true); setSubmitting(false); onRegistrationStopped();
      }, 0);
      return () => window.clearTimeout(stop);
    }
    let active = true;
    const timer = window.setTimeout(() => {
      if (!active || registrationResumeRef.current === registrationId) return;
      registrationResumeRef.current = registrationId;
      let paymentStarting = false;
      let paymentCreated = false;
      let context: ReturnType<typeof beginCardRegistrationReturn>;
      try {
        context = beginCardRegistrationReturn(registrationId, product.id);
      } catch (reason) {
        setError(presentCardRegistrationProblem(reason).message);
        setSubmissionLocked(true);
        setSubmitting(false);
        onRegistrationStopped();
        return;
      }
      if (!context) {
        setError(presentCardRegistrationProblem(null).message);
        setSubmissionLocked(true);
        setSubmitting(false);
        onRegistrationStopped();
        return;
      }
      window.history.replaceState(null, "", pointPurchaseDetailRoute(product.id));
      setMethod("credit_card");
      setSubmitting(true);
      setError(null);

      const finishWithoutPayment = (registration: PaymentCardRegistration) => {
        if (["failed", "canceled", "expired"].includes(registration.status)) {
          clearCardRegistrationResume(registration.id);
          setError(presentCardRegistrationProblem(null).message);
          setSubmitting(false);
          onRegistrationStopped();
          void refreshCards().catch(() => undefined);
          return;
        }
        setError(presentCardRegistrationProblem(new StorefrontTransportError(
          "HTTP_ERROR",
          "Card registration remains incomplete",
        )).message);
        setSubmissionLocked(true);
        setSubmitting(false);
        onRegistrationStopped();
      };

      const resume = async () => {
        try {
          let registration = (await client.getCardRegistration(registrationId)).data;
          if (registration.status === "pending" || registration.status === "requires_action") {
            registration = (await client.reconcileCardRegistration(registrationId)).data;
          }
          if (!active) return;
          if (registration.status !== "completed" || !registration.saved_card_id) {
            finishWithoutPayment(registration);
            return;
          }
          setSelectedCardId(registration.saved_card_id);
          setCardMounted(false);
          const paymentContext = markCardRegistrationPaymentStarting(registrationId);
          if (!paymentContext) throw new Error("Card registration Payment resume is unavailable");
          paymentStarting = true;
          const payment = await startSavedCardPayment(
            registration.saved_card_id,
            paymentContext.paymentIdempotencyKey,
          );
          paymentCreated = true;
          if (!active) return;
          void refreshCards().catch(() => undefined);
          await navigateAfterStart(payment, "credit_card", true);
          clearCardRegistrationResume(registrationId);
        } catch (reason) {
          if (!active) return;
          const uncertain = isUncertainCardRegistrationProblem(reason) ||
            paymentStarting && (paymentCreated || reason instanceof StorefrontTransportError);
          const definitiveRegistrationFailure = !paymentStarting &&
            isDefinitiveCardRegistrationProblem(reason);
          if (!uncertain && (paymentStarting || definitiveRegistrationFailure)) {
            clearCardRegistrationResume(registrationId);
          }
          setError(paymentStarting
            ? presentPaymentProblem(reason, "credit_card").message
            : presentCardRegistrationProblem(reason).message);
          setSubmissionLocked(uncertain || !paymentStarting && !definitiveRegistrationFailure);
          setSubmitting(false);
          onRegistrationStopped();
          if (paymentStarting && !uncertain) void refreshCards().catch(() => undefined);
        }
      };
      void resume();
    }, 0);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [client, navigateAfterStart, onRegistrationStopped, options, product.id, refreshCards, registrationId, startSavedCardPayment]);

  const deleteCard = async (cardId: string) => {
    if (!savedCardsEnabled || !client || cardBusy || submitting) return;
    setCardBusy(true);
    setError(null);
    try {
      await client.deleteCard(cardId);
      await refreshCards();
    } catch (reason) {
      setError(presentPaymentProblem(reason).message);
    } finally {
      setCardBusy(false);
    }
  };

  const backendUnavailable = !product.is_available || !product.eligible || product.cta.state !== "enabled";
  const selectedSavedCard = selectedCardId && selectedCardId !== "new" ? cards.find((card) => card.id === selectedCardId) : null;
  const cardUnavailable = method === "credit_card" && !providerMethod && (
    !selectedCardId || selectedCardId === "new" ? !cardMounted : !selectedSavedCard?.can_pay || selectedSavedCard.is_expired
  );
  const fincodeDisabled = method === "credit_card" && !providerMethod && !savedCardsEnabled;
  const disabled = !method || !selectedOption?.available || !supportedPaymentMethod(selectedOption) || fincodeDisabled || backendUnavailable || submitting || cardBusy || cardUnavailable || submissionLocked ||
    providerMethod && (!uiGateway || providerBusy || providerLocked || selectedOption?.flow === "inline_card_form" && ((!inlineValid && !providerValidates) || !inlineMounted));
  const canSaveCard = (cardLimits?.registration_remaining ?? 0) > 0;

  if (registrationProcessing) return <CatalogLoading label="処理中…" />;

  return (
    <section aria-labelledby="payment-method-title" className="point-purchase-detail__payment">
      <h2 className="sr-only" id="payment-method-title">お支払方法</h2>
      <PaymentMethodSelector
        cardBusy={cardBusy || submitting}
        disabled={submitting || providerBusy || submissionLocked || providerLocked}
        options={options}
        cardsLoaded={cardsLoaded}
        cards={cards}
        onDeleteCard={(cardId) => { void deleteCard(cardId); }}
        onMethodChange={(next) => {
          if (submitting || providerBusy || submissionLocked || providerLocked) return;
          const destination = new URL(window.location.href);
          destination.searchParams.set("payment_method", next);
          if (leaveProviderDocument(destination.href)) return;
          setConfirmationOpen(false);
          setMethod(next);
          setError(null);
          if (next === "credit_card" && options.find(o => o.method === next)?.saved_cards_enabled && !cardsLoaded) loadCards();
        }}
        onNewCard={openNewCard}
        onRetryCards={loadCards}
        onSavedCardChange={(cardId) => { setSelectedCardId(cardId); setCardMounted(false); }}
        selectedCardId={selectedCardId}
        selectedMethod={method}
      >
        {providerMethod ? <div className="payment-inline-card">
          <p>Visa・Mastercard</p>
          <div aria-label="決済会社のカード入力欄" ref={attachTarget} />
          {!inlineMounted ? <p role="status">カード入力欄を準備中です。</p> : null}
          {inlineMounted && !inlineValid && !providerValidates ? <button onClick={() => { void checkValidity(); }} type="button">入力内容を確認する</button> : null}
          <p>カード情報はオリポケのサーバーを通らず、保存もしません。カード会社による本人認証の画面が表示される場合があります。</p>
        </div> : <div className="payment-new-card">
          {bootstrap ? <FincodeCardFields bootstrap={bootstrap} onError={onCardUiError} onMountStateChange={onCardMountStateChange} ref={cardFieldsRef} />
            : <div aria-live="polite" className="payment-card-loading" role="status">カード入力欄を準備中です。</div>}
        </div>}
      </PaymentMethodSelector>
      {error || providerMethod && providerError ? <p className="payment-inline-error" role="alert">{providerMethod ? providerError ?? error : error}</p> : null}
      {method && selectedOption && (!supportedPaymentMethod(selectedOption) || fincodeDisabled) ? <p role="alert">{PAYMENT_UI_UNAVAILABLE}</p> : null}
      {providerMethod && providerMessage && !providerBusy ? <p role="status">{providerMessage} <Link href="/mypage/purchases">購入履歴</Link></p> : null}
      {submissionLocked ? <p className="payment-submission-locked">決済状況を確認できるまで、新しい決済は開始できません。</p> : null}
      <button className="button button--dark payment-purchase-button" disabled={disabled} onClick={() => {
        if (!providerMethod && savedCardsEnabled && method === "credit_card" && selectedCardId === "new") setConfirmationOpen(true);
        else void submitPayment();
      }} type="button">
        {submitting || providerBusy ? "処理中…" : "購入する"}
      </button>
      {providerMethod && providerBusy && providerMessage ? <PaymentProcessingOverlay message={providerMessage} /> : null}
      {confirmationOpen ? (
        <CardSaveConfirmation
          busy={submitting}
          canSave={canSaveCard}
          nextCapacityAt={cardLimits?.next_capacity_at ?? null}
          onBack={() => setConfirmationOpen(false)}
          onBuyWithoutSaving={() => { setConfirmationOpen(false); void submitPayment(); }}
          onSaveAndBuy={() => { void saveAndBuy(); }}
        />
      ) : null}
    </section>
  );
}

function ProductDetail({
  authenticated,
  pid,
  product,
  registrationId,
  subject,
}: {
  readonly authenticated: boolean;
  readonly pid: string | null;
  readonly product: PointProduct;
  readonly registrationId: string | null;
  readonly subject: string;
}) {
  const { client } = usePaymentClient();
  // Return context signals work in progress, never canonical registration success.
  const [stoppedRegistrationId, setStoppedRegistrationId] = useState<string | null>(null);
  const registrationProcessing = authenticated && Boolean(client && registrationId) && stoppedRegistrationId !== registrationId;
  const onRegistrationStopped = useCallback(() => setStoppedRegistrationId(registrationId), [registrationId]);
  const reason = product.ineligible_reason ? pointProductIneligibleReasonLabels[product.ineligible_reason] : null;
  return (
    <article aria-busy={registrationProcessing} className="point-purchase-detail">
      {!registrationProcessing ? <header className="point-purchase-detail__header"><p>COIN PURCHASE DETAIL</p><h1>{presentCoinTerminology(product.title)}</h1></header> : null}
      {client ? <PaymentReturnAlert client={client} pid={pid} productId={product.id} /> : null}
      {!registrationProcessing ? <PurchaseSummary product={product} /> : null}
      {authenticated ? <PaymentMethodLoader productId={product.id} subject={subject}>{(options) =>
        <PurchaseForm options={options} product={product} registrationId={registrationId} registrationProcessing={registrationProcessing} onRegistrationStopped={onRegistrationStopped} subject={subject} />
      }</PaymentMethodLoader> : <LoginRequiredState />}
      {!registrationProcessing ? <section aria-labelledby="point-purchase-conditions-title" className="point-purchase-detail__conditions">
        <header><p>PRODUCT INFORMATION</p><h2 id="point-purchase-conditions-title">商品情報</h2></header>
        <dl>
          <div><dt>対象</dt><dd>{product.audience.label}</dd></div>
          <div><dt>販売状態</dt><dd data-sale-state={product.sale_state}>{pointProductSaleStateLabels[product.sale_state]}</dd></div>
          <div><dt>購入条件</dt><dd data-eligible={product.eligible}>{product.eligible ? "購入対象です。" : reason ?? "現在購入できません。"}</dd></div>
        </dl>
      </section> : null}
    </article>
  );
}

export function PointPurchaseDetail(props: {
  readonly pid?: string | null;
  readonly productId: string;
  readonly registrationId?: string | null;
}) {
  usePaymentReturnEvent(props.pid ?? null);
  const { state, smsAccess } = useSession();
  const { client } = usePaymentClient();
  return <>
    {state.status === "authenticated" && (smsAccess === "unverified" || smsAccess === "error") && client && (
      <>
        <PaymentReturnAlert client={client} pid={props.pid ?? null} productId={props.productId} />
        {props.registrationId && <CardReturnStatus productId={props.productId} registrationId={props.registrationId} />}
      </>
    )}
    <MemberAccess loading={<CatalogLoading label={props.registrationId ? "処理中…" : "コイン購入詳細を読み込み中"} />}><PointPurchaseDetailContent {...props} /></MemberAccess>
  </>;
}

function CardReturnStatus({ productId, registrationId }: { readonly productId: string; readonly registrationId: string }) {
  const { client } = usePaymentClient();
  const [status, setStatus] = useState<"loading" | "complete" | "pending" | "error">("loading");
  useEffect(() => {
    if (!client) return;
    let active = true;
    void Promise.resolve().then(() => {
      const context = readCardRegistrationResume();
      if (context?.registrationId !== registrationId || context.productId !== productId) throw new Error("Card return unavailable");
      return client.getCardRegistration(registrationId);
    }).then(({ data }) => {
      if (active) setStatus(data.status === "completed" ? "complete" : "pending");
    }).catch(() => { if (active) setStatus("error"); });
    return () => { active = false; };
  }, [client, productId, registrationId]);
  return <p role="status">{status === "loading" ? "カード登録状況を確認中…" : status === "complete"
    ? "カード登録を確認しました。購入を続けるにはSMS認証を完了してください。"
    : status === "error" ? "カード登録状況を確認できませんでした。SMS認証後に再確認してください。"
    : "カード登録はまだ完了していません。SMS認証後に再確認してください。"}</p>;
}

function PointPurchaseDetailContent({
  pid = null,
  productId,
  registrationId = null,
}: {
  readonly pid?: string | null;
  readonly productId: string;
  readonly registrationId?: string | null;
}) {
  const { state: session } = useSession();
  const { client } = usePointClient();
  const [requestKey, setRequestKey] = useState(0);
  const [state, setState] = useState<DetailState>(client ? { status: "loading" } : { status: "configuration-unavailable" });
  const sessionKey = session.status === "authenticated" ? session.session.user?.id ?? null
    : session.status === "unauthenticated" || session.status === "session-expired" ? "anonymous" : null;

  useEffect(() => {
    if (!client || !sessionKey) return;
    let active = true;
    void client.listPointProducts().then(({ data }) => {
      if (active) setState({ collection: data, productId, sessionKey, status: "ready" });
    }).catch((error: unknown) => {
      if (active) setState({ problem: presentPlatformProblem(error), productId, sessionKey, status: "error" });
    });
    return () => { active = false; };
  }, [client, productId, requestKey, sessionKey]);

  const displayState = useMemo<DetailState>(() => !client ? { status: "configuration-unavailable" }
    : session.status === "configuration-unavailable" ? { status: "configuration-unavailable" }
      : session.status === "error" ? { status: "session-error" }
        : !sessionKey || (state.status === "ready" || state.status === "error") && (state.sessionKey !== sessionKey || state.productId !== productId)
          ? { status: "loading" } : state, [client, productId, session.status, sessionKey, state]);

  const refreshOffer = useCallback(() => setRequestKey(value => value + 1), []);
  useFirstBuyCountdown(displayState.status === "ready" ? displayState.collection : null, refreshOffer);

  if (displayState.status === "loading") return <CatalogLoading label={registrationId ? "処理中…" : "コイン購入詳細を読み込み中"} />;
  if (displayState.status === "configuration-unavailable") return <CatalogMessage description="この環境ではコイン商品への接続が設定されていません。" eyebrow="CONFIGURATION" title="コイン購入詳細を表示できません" />;
  if (displayState.status === "session-error") return <CatalogMessage description="Sessionを確認できませんでした。時間をおいて再度お試しください。" eyebrow="ERROR" title="コイン購入詳細を表示できません" tone="error" />;
  if (displayState.status === "error") return <CatalogMessage action={() => { setState({ status: "loading" }); setRequestKey((value) => value + 1); }} description={displayState.problem.message} eyebrow="ERROR" title="コイン商品を取得できませんでした" tone="error" />;
  const product = displayState.collection.data.find((candidate) => candidate.id === productId);
  if (!product) return <CatalogMessage description="指定されたコイン商品は公開されていないか、見つかりません。" eyebrow="NOT FOUND" title="コイン商品が見つかりません" />;
  return <ProductDetail authenticated={session.status === "authenticated"} key={`${sessionKey}:${product.id}`} pid={pid} product={product} registrationId={registrationId} subject={sessionKey ?? "anonymous"} />;
}
