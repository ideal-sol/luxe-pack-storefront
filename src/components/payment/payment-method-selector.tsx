"use client";

import type { PaymentCard } from "@/lib/platform";
import { brandAssetUrl } from "@/lib/brand-assets";
import { supportedPaymentMethod, type PaymentMethodOption } from "@/lib/platform/payment-ui-gateway";

const presentation: Record<string, { logo?: string; description?: string }> = {
  netridecash: { logo: "payments/netridecash-logo.png", description: "決済会社（テックコイン）の画面で NetRideCash の番号を入力します" },
  // Official branding example 2 permits logo-only. P3 wording remains Human OPEN.
  paidy: { logo: "payments/paidy-logo.png" },
};

const transferNotice = "※原則お振込みをしていただきましたら、即時コインの反映されますが、土日祝日や平日の場合でもコイン残高に反映されるまで最大で3日程度かかる場合がございます";

function cardLabel(card: PaymentCard) {
  const brand = card.brand ?? "CARD";
  const month = String(card.expiration.month).padStart(2, "0");
  return `${brand} •••• ${card.last4}　${month}/${card.expiration.year}`;
}

export function PaymentMethodSelector({
  cardBusy,
  cardsLoaded,
  cards,
  children,
  onDeleteCard,
  onMethodChange,
  onNewCard,
  onRetryCards,
  onSavedCardChange,
  selectedCardId,
  selectedMethod,
  options,
  disabled = false,
}: {
  readonly cardBusy: boolean;
  readonly cardsLoaded: boolean;
  readonly cards: readonly PaymentCard[];
  readonly children?: React.ReactNode;
  readonly onDeleteCard: (cardId: string) => void;
  readonly onMethodChange: (method: string) => void;
  readonly onNewCard: () => void;
  readonly onRetryCards: () => void;
  readonly onSavedCardChange: (cardId: string) => void;
  readonly selectedCardId: string | "new" | null;
  readonly selectedMethod: string | null;
  readonly options: readonly PaymentMethodOption[];
  readonly disabled?: boolean;
}) {
  return (
    <fieldset className="payment-methods">
      <legend>お支払方法</legend>
      <div className="payment-methods__list">
        {options.map((method) => {
          const checked = selectedMethod === method.method;
          const display = presentation[method.method];
          const reason = !method.available || !supportedPaymentMethod(method) ? method.unavailable_reason === "amount_too_large"
            ? "この商品はこのお支払い方法ではご購入いただけません" : "現在ご利用いただけません" : null;
          return (
            <div className={`payment-method-row${checked ? " payment-method-row--selected" : ""}`} key={method.method}>
              <label className="payment-method-row__label">
                <input
                  checked={checked}
                  disabled={disabled || !method.available || !supportedPaymentMethod(method)}
                  name="payment-method"
                  onChange={() => { if (!disabled && method.available) onMethodChange(method.method); }}
                  type="radio"
                  value={method.method}
                />
                {display?.logo ? <span className={`payment-method-row__logo payment-method-row__logo--${method.method}`}>
                  {/* Unmodified supplied Brand assets; no optimizer re-encoding. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" src={brandAssetUrl(display.logo)} />
                </span> : method.method === "credit_card" ? <svg aria-hidden="true" className="payment-method-row__card-icon" fill="none" height="26" viewBox="0 0 36 26" width="36"><rect height="22" rx="3" stroke="currentColor" strokeWidth="2" width="32" x="2" y="2" /><path d="M3 9h30M7 18h8" stroke="currentColor" strokeWidth="2" /></svg> : null}
                <span>{method.label}</span>
              </label>
              {display?.description ? <p className="payment-method-row__description">{display.description}</p> : null}
              {reason ? <p className="payment-method-row__reason">{reason}</p> : null}
              {checked && method.method === "credit_card" && method.flow === "inline_card_form" ? children : null}
              {checked && method.method === "credit_card" && method.flow === "card_component" && method.saved_cards_enabled ? (
                <div className="payment-card-options">
                  {!cardsLoaded ? (
                    cardBusy
                      ? <p aria-live="polite" className="payment-card-options__empty" role="status">登録カードを読み込み中です。</p>
                      : <button className="payment-card-add" onClick={onRetryCards} type="button">登録カードを再読み込みする</button>
                  ) : cards.length > 0 ? (
                    <fieldset>
                      <legend>登録カード</legend>
                      {cards.map((card) => {
                        const usable = !card.is_expired && card.can_pay;
                        return (
                          <div className={`payment-saved-card${usable ? "" : " payment-saved-card--unavailable"}`} key={card.id}>
                            <label>
                              <input
                                checked={selectedCardId === card.id}
                                disabled={!usable || cardBusy}
                                name="payment-card"
                                onChange={() => onSavedCardChange(card.id)}
                                type="radio"
                              />
                              <span>{cardLabel(card)}</span>
                              {!usable ? <small>利用できません</small> : null}
                            </label>
                            <button
                              className="payment-card-delete"
                              disabled={cardBusy}
                              onClick={() => onDeleteCard(card.id)}
                              type="button"
                            >
                              削除
                            </button>
                          </div>
                        );
                      })}
                    </fieldset>
                  ) : <p className="payment-card-options__empty">登録カードはありません。</p>}
                  {cardsLoaded && cards.length < 3 ? (
                    <button className="payment-card-add" disabled={cardBusy} onClick={onNewCard} type="button">
                      ＋クレジットカードを追加する（最大3枚まで）
                    </button>
                  ) : null}
                  {selectedCardId === "new" ? children : null}
                </div>
              ) : null}
              {checked && method.method === "konbini" ? <p className="payment-method-row__notice">{transferNotice}</p> : null}
              {checked && method.method === "virtual_account" ? (
                <div className="payment-method-row__notices">
                  <p>{transferNotice}</p>
                  <p>※毎月第2土曜午後9時50分〜翌日曜午前6時は定期メンテナンスのためご利用いただけません</p>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
