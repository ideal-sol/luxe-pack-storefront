"use client";

import Link from "next/link";
import { cloneElement, useRef, useState, type ReactElement } from "react";
import { useSession } from "@/components/auth/session-provider";
import {
  presentContactProblem,
  type ContactInquiryReceipt,
  type ContactProblemPresentation,
} from "@/lib/platform";
import { useContactClient } from "./contact-client-provider";

const fieldIds = {
  body: "contact-body",
  email: "contact-email",
  name: "contact-name",
  phone: "contact-phone",
  subject: "contact-subject",
} as const;

export function ContactForm() {
  const { state: session } = useSession();
  const { client, configurationAvailable } = useContactClient();
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [problem, setProblem] = useState<ContactProblemPresentation | null>(null);
  const [receipt, setReceipt] = useState<ContactInquiryReceipt | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!client || submittingRef.current) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    submittingRef.current = true;
    setSubmitting(true);
    setProblem(null);
    try {
      const response = await client.submitContact({
        body: String(data.get("body") ?? ""),
        email: String(data.get("email") ?? ""),
        name: String(data.get("name") ?? ""),
        phone: String(data.get("phone") ?? "") || null,
        subject: String(data.get("subject") ?? ""),
        website: "",
      });
      form.reset();
      setReceipt(response.data);
    } catch (error) {
      setProblem(presentContactProblem(error));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  if (receipt) {
    return (
      <section className="contact-receipt" role="status">
        <span aria-hidden="true">✓</span>
        <h2>お問い合わせを受け付けました</h2>
        <p>受付番号: <strong>{receipt.receipt_code}</strong></p>
        <p>受付番号はお問い合わせ内容の確認に必要です。</p>
        {session.status === "authenticated" && <Link className="button button--dark" href="/mypage">マイページへ戻る</Link>}
      </section>
    );
  }

  const sessionMessage = session.status === "authenticated"
    ? "ログイン中のアカウントからお問い合わせいただけます。氏名とメールアドレスを入力してください。"
    : session.status === "unauthenticated" || session.status === "session-expired"
      ? "会員登録やログインなしでお問い合わせいただけます。"
      : "ログイン状態にかかわらずお問い合わせいただけます。";
  const unavailable = !configurationAvailable;

  return (
    <div className="contact-panel">
      <p className="contact-panel__session">{sessionMessage}</p>
      {(unavailable || problem) && (
        <div className="contact-problem" role="alert">
          <strong>お問い合わせを送信できませんでした</strong>
          <p>{unavailable ? "現在の環境ではお問い合わせ接続が設定されていません。" : problem?.message}</p>
        </div>
      )}
      <form className="contact-form" onSubmit={submit}>
        <div className="contact-form__fields">
          <ContactField field="name" label="お名前" problem={problem}>
            <input autoComplete="name" disabled={submitting || unavailable} id={fieldIds.name} maxLength={120} name="name" required type="text" />
          </ContactField>
          <ContactField field="email" label="メールアドレス" problem={problem}>
            <input autoComplete="email" disabled={submitting || unavailable} id={fieldIds.email} maxLength={320} name="email" required type="email" />
          </ContactField>
          <ContactField field="phone" label="電話番号（任意）" problem={problem}>
            <input autoComplete="tel" disabled={submitting || unavailable} id={fieldIds.phone} maxLength={32} name="phone" type="tel" />
          </ContactField>
          <ContactField className="contact-field--wide" field="subject" label="件名" problem={problem}>
            <input disabled={submitting || unavailable} id={fieldIds.subject} maxLength={191} name="subject" required type="text" />
          </ContactField>
          <ContactField className="contact-field--wide" field="body" label="お問い合わせ内容" problem={problem}>
            <textarea disabled={submitting || unavailable} id={fieldIds.body} maxLength={5000} name="body" required rows={8} />
          </ContactField>
        </div>
        <p className="contact-form__notice">入力内容をご確認のうえ送信してください。</p>
        <button className="button button--dark contact-form__submit" disabled={submitting || unavailable} type="submit">
          {submitting ? "送信中…" : "お問い合わせを送信"}
        </button>
      </form>
    </div>
  );
}

function ContactField({
  children,
  className,
  field,
  label,
  problem,
}: {
  readonly children: ReactElement<{ readonly "aria-describedby"?: string }>;
  readonly className?: string;
  readonly field: keyof typeof fieldIds;
  readonly label: string;
  readonly problem: ContactProblemPresentation | null;
}) {
  const messages = problem?.fieldErrors[field];
  const errorId = `${fieldIds[field]}-error`;
  return (
    <div className={`form-field${className ? ` ${className}` : ""}`}>
      <label htmlFor={fieldIds[field]}>{label}</label>
      {messages?.length ? cloneElement(children, { "aria-describedby": errorId }) : children}
      {messages?.length ? <p className="form-field__error" id={errorId}>{messages[0]}</p> : null}
    </div>
  );
}
