"use client";

import type { PaymentCard, PaymentMethod } from "@/lib/platform";

const methods: ReadonlyArray<{ readonly label: string; readonly value: PaymentMethod }> = [
  { label: "クレジットカード", value: "credit_card" },
  { label: "PayPay", value: "paypay" },
  { label: "コンビニ決済", value: "konbini" },
  { label: "銀行振込", value: "virtual_account" },
];

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
}: {
  readonly cardBusy: boolean;
  readonly cardsLoaded: boolean;
  readonly cards: readonly PaymentCard[];
  readonly children?: React.ReactNode;
  readonly onDeleteCard: (cardId: string) => void;
  readonly onMethodChange: (method: PaymentMethod) => void;
  readonly onNewCard: () => void;
  readonly onRetryCards: () => void;
  readonly onSavedCardChange: (cardId: string) => void;
  readonly selectedCardId: string | "new" | null;
  readonly selectedMethod: PaymentMethod | null;
}) {
  return (
    <fieldset className="payment-methods">
      <legend>お支払方法</legend>
      <div className="payment-methods__list">
        {methods.map((method) => {
          const checked = selectedMethod === method.value;
          return (
            <div className={`payment-method-row${checked ? " payment-method-row--selected" : ""}`} key={method.value}>
              <label className="payment-method-row__label">
                <input
                  checked={checked}
                  name="payment-method"
                  onChange={() => onMethodChange(method.value)}
                  type="radio"
                  value={method.value}
                />
                <span>{method.label}</span>
              </label>
              {checked && method.value === "credit_card" ? (
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
              {checked && method.value === "konbini" ? <p className="payment-method-row__notice">{transferNotice}</p> : null}
              {checked && method.value === "virtual_account" ? (
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
