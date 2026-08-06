"use client";

interface ConfirmationDialogProps {
  readonly confirmLabel?: string;
  readonly description: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly open: boolean;
  readonly title: string;
}

export function ConfirmationDialog({
  confirmLabel = "確認する",
  description,
  onCancel,
  onConfirm,
  open,
  title,
}: ConfirmationDialogProps) {
  if (!open) return null;

  return (
    <div className="dialog-backdrop" role="presentation">
      <section aria-modal="true" className="dialog-card" role="dialog">
        <p className="dialog-card__eyebrow">CONFIRM</p>
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="dialog-card__actions">
          <button className="button button--ghost" onClick={onCancel} type="button">
            キャンセル
          </button>
          <button className="button button--dark" onClick={onConfirm} type="button">
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
