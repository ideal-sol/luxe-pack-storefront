"use client";

function capacityMessage(nextCapacityAt: string | null) {
  if (!nextCapacityAt) return "カードを保存できる上限に達しています。";
  const value = new Date(nextCapacityAt);
  if (Number.isNaN(value.getTime())) return "カードを保存できる上限に達しています。";
  const formatted = new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(value);
  return `カードの保存は${formatted}以降に再度お試しください。`;
}

export function CardSaveConfirmation({
  busy,
  canSave,
  nextCapacityAt,
  onBack,
  onBuyWithoutSaving,
}: {
  readonly busy: boolean;
  readonly canSave: boolean;
  readonly nextCapacityAt: string | null;
  readonly onBack: () => void;
  readonly onBuyWithoutSaving: () => void;
}) {
  return (
    <div
      className="payment-save-confirmation"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !busy) onBack();
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onBack();
      }}
      role="presentation"
    >
      <section
        aria-describedby="payment-save-confirmation-description"
        aria-labelledby="payment-save-confirmation-title"
        aria-modal="true"
        className="payment-save-confirmation__dialog"
        role="dialog"
      >
        <h2 id="payment-save-confirmation-title">このカードを保存しますか？</h2>
        <p id="payment-save-confirmation-description">
          カードを保存すると、次回以降はカード情報の入力を省略できます。
        </p>
        {!canSave ? <p className="payment-save-confirmation__capacity">{capacityMessage(nextCapacityAt)}</p> : null}
        <div className="payment-save-confirmation__actions">
          <button autoFocus className="button button--ghost" disabled={busy} onClick={onBack} type="button">戻る</button>
          <button className="button button--ghost" disabled={busy} onClick={onBuyWithoutSaving} type="button">保存せず購入</button>
        </div>
      </section>
    </div>
  );
}
