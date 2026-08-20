import { ApiProblemError, StorefrontTransportError } from "@oripa/storefront-client";

export interface ContactProblemPresentation {
  readonly fieldErrors: Readonly<Record<string, readonly string[]>>;
  readonly message: string;
}

export function presentContactProblem(error: unknown): ContactProblemPresentation {
  if (error instanceof ApiProblemError) {
    if (error.status === 422) {
      return {
        fieldErrors: error.errors ?? {},
        message: "入力内容を確認してください。",
      };
    }
    if (error.status === 429) {
      return {
        fieldErrors: {},
        message: "送信回数が上限に達しました。時間をおいて、もう一度お試しください。",
      };
    }
    return {
      fieldErrors: {},
      message: "お問い合わせを送信できませんでした。時間をおいて、もう一度お試しください。",
    };
  }
  if (error instanceof StorefrontTransportError) {
    return {
      fieldErrors: {},
      message: "通信を完了できませんでした。お問い合わせは自動再送されていません。接続を確認して、もう一度お試しください。",
    };
  }
  return {
    fieldErrors: {},
    message: "予期しない問題が発生しました。時間をおいて、もう一度お試しください。",
  };
}
