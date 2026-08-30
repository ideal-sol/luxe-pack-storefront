"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { AuthProblem, FieldProblem } from "@/components/auth/auth-problem";
import { useSession } from "@/components/auth/session-provider";
import { LoadingState } from "@/components/common/loading-state";
import { ErrorState, LoginRequiredState } from "@/components/common/state-panel";
import {
  presentAccountSecurityProblem,
  type AccountSecurityProblemPresentation,
} from "@/lib/platform";
import { PasswordFields } from "./password-fields";

export function PasswordChangeForm() {
  const router = useRouter();
  const { changePassword, refreshSession, state } = useSession();
  const [confirmPassword, setConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [mismatch, setMismatch] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [problem, setProblem] = useState<AccountSecurityProblemPresentation | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current) return;
    if (newPassword !== confirmPassword) {
      setMismatch(true);
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    setMismatch(false);
    setProblem(null);
    try {
      await changePassword({ current_password: currentPassword, new_password: newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      router.replace("/mypage?account-updated=password");
    } catch (error) {
      const presented = presentAccountSecurityProblem(error, "password-change");
      setProblem(presented);
      if (presented.authenticationRequired) void refreshSession();
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (state.status === "loading") return <LoadingState />;
  if (state.status === "unauthenticated" || state.status === "session-expired") return <LoginRequiredState />;
  if (state.status === "configuration-unavailable" || state.status === "error") return <ErrorState />;

  const currentPasswordError = problem?.fieldErrors.current_password?.[0];
  return (
    <form className="auth-form" onSubmit={submit}>
      <AuthProblem problem={problem} />
      <div className="form-field">
        <label htmlFor="password-change-current-password">現在のパスワード</label>
        <span className="password-field__control">
          <input
            aria-describedby={currentPasswordError ? "password-change-current-password-error" : undefined}
            autoComplete="current-password"
            disabled={submitting}
            id="password-change-current-password"
            maxLength={128}
            minLength={1}
            name="current_password"
            onChange={(event) => setCurrentPassword(event.target.value)}
            required
            type={showCurrentPassword ? "text" : "password"}
            value={currentPassword}
          />
          <button
            aria-label={`現在のパスワードを${showCurrentPassword ? "隠す" : "表示"}`}
            className="password-field__toggle"
            disabled={submitting}
            onClick={() => setShowCurrentPassword((visible) => !visible)}
            type="button"
          >
            {showCurrentPassword ? "隠す" : "表示"}
          </button>
        </span>
        <span id="password-change-current-password-error"><FieldProblem field="current_password" problem={problem} /></span>
      </div>
      <PasswordFields
        confirmPassword={confirmPassword}
        disabled={submitting}
        fieldErrors={problem?.fieldErrors ?? {}}
        idPrefix="password-change"
        mismatch={mismatch}
        newPassword={newPassword}
        newPasswordName="new_password"
        onConfirmPasswordChange={(value) => {
          setConfirmPassword(value);
          if (mismatch) setMismatch(value !== newPassword);
        }}
        onNewPasswordChange={(value) => {
          setNewPassword(value);
          if (mismatch) setMismatch(value !== confirmPassword);
        }}
      />
      <button className="button button--dark auth-form__submit" disabled={submitting} type="submit">
        {submitting ? "更新中…" : "更新"}
      </button>
    </form>
  );
}
