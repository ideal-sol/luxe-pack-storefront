"use client";

import { useId } from "react";

interface ConfirmationDialogProps {
  readonly confirmDisabled?: boolean;
  readonly confirmLabel?: string;
  readonly description: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly open: boolean;
  readonly title: string;
}

export function ConfirmationDialog({
  confirmDisabled = false,
  confirmLabel = "確認する",
  description,
  onCancel,
  onConfirm,
  open,
  title,
}: ConfirmationDialogProps) {
  const titleId = useId();
  if (!open) return null;

  return (
    <div className="dialog-backdrop" role="presentation">
      <section aria-labelledby={titleId} aria-modal="true" className="dialog-card" role="dialog">
        <p className="dialog-card__eyebrow">CONFIRM</p>
        <h2 id={titleId}>{title}</h2>
        <p>{description}</p>
        <div className="dialog-card__actions">
          <button className="button button--ghost" onClick={onCancel} type="button">
            キャンセル
          </button>
          <button className="button button--dark" disabled={confirmDisabled} onClick={onConfirm} type="button">
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
