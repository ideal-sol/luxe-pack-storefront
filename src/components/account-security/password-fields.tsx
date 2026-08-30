"use client";

import { useState } from "react";

interface PasswordFieldsProps {
  readonly confirmPassword: string;
  readonly disabled: boolean;
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
  readonly idPrefix: string;
  readonly mismatch: boolean;
  readonly newPassword: string;
  readonly newPasswordName: "new_password" | "password";
  readonly onConfirmPasswordChange: (value: string) => void;
  readonly onNewPasswordChange: (value: string) => void;
}

export function PasswordFields({
  confirmPassword,
  disabled,
  fieldErrors,
  idPrefix,
  mismatch,
  newPassword,
  newPasswordName,
  onConfirmPasswordChange,
  onNewPasswordChange,
}: PasswordFieldsProps) {
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const newPasswordError = fieldErrors[newPasswordName]?.[0];
  const newPasswordErrorId = `${idPrefix}-new-password-error`;
  const confirmationErrorId = `${idPrefix}-password-confirmation-error`;

  return (
    <>
      <div className="form-field">
        <label htmlFor={`${idPrefix}-new-password`}>新しいパスワード</label>
        <span className="password-field__control">
          <input
            aria-describedby={newPasswordError ? newPasswordErrorId : undefined}
            autoComplete="new-password"
            disabled={disabled}
            id={`${idPrefix}-new-password`}
            maxLength={128}
            minLength={8}
            name={newPasswordName}
            onChange={(event) => onNewPasswordChange(event.target.value)}
            required
            type={showNewPassword ? "text" : "password"}
            value={newPassword}
          />
          <button
            aria-label={`新しいパスワードを${showNewPassword ? "隠す" : "表示"}`}
            className="password-field__toggle"
            disabled={disabled}
            onClick={() => setShowNewPassword((visible) => !visible)}
            type="button"
          >
            {showNewPassword ? "隠す" : "表示"}
          </button>
        </span>
        <small>8文字以上128文字以内</small>
        {newPasswordError ? <p className="form-field__error" id={newPasswordErrorId}>{newPasswordError}</p> : null}
      </div>

      <div className="form-field">
        <label htmlFor={`${idPrefix}-password-confirmation`}>新しいパスワード確認</label>
        <span className="password-field__control">
          <input
            aria-describedby={mismatch ? confirmationErrorId : undefined}
            autoComplete="new-password"
            disabled={disabled}
            id={`${idPrefix}-password-confirmation`}
            maxLength={128}
            minLength={8}
            name="password_confirmation"
            onChange={(event) => onConfirmPasswordChange(event.target.value)}
            required
            type={showConfirmation ? "text" : "password"}
            value={confirmPassword}
          />
          <button
            aria-label={`新しいパスワード確認を${showConfirmation ? "隠す" : "表示"}`}
            className="password-field__toggle"
            disabled={disabled}
            onClick={() => setShowConfirmation((visible) => !visible)}
            type="button"
          >
            {showConfirmation ? "隠す" : "表示"}
          </button>
        </span>
        {mismatch ? <p className="form-field__error" id={confirmationErrorId}>新しいパスワードが一致しません。</p> : null}
      </div>
    </>
  );
}
