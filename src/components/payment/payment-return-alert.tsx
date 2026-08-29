"use client";

import { useEffect, useState } from "react";
import type { PaymentClientAdapter } from "@/lib/platform";

type ReturnState = { readonly message: string; readonly pid: string };

function validPid(pid: string) {
  return pid.length > 0 && pid.length <= 128 && !pid.includes("/") && !pid.includes("\0");
}

export function PaymentReturnAlert({
  client,
  pid,
  productId,
}: {
  readonly client: PaymentClientAdapter;
  readonly pid: string | null;
  readonly productId: string;
}) {
  const [state, setState] = useState<ReturnState | null>(null);

  useEffect(() => {
    if (!pid || !validPid(pid)) return;
    let active = true;
    void client.getPayment(pid)
      .then(({ data: payment }) => {
        if (!active) return;
        if (payment.point_product_id && payment.point_product_id !== productId) {
          setState({ message: "決済情報を確認できませんでした。", pid });
          return;
        }
        const message = payment.status === "canceled"
          ? "決済をキャンセルしました。"
          : payment.status === "expired"
            ? "決済の有効期限が切れました。"
            : "決済が失敗しました。";
        setState({ message, pid });
      })
      .catch(() => {
        if (active) setState({ message: "決済情報を確認できませんでした。", pid });
      });
    return () => { active = false; };
  }, [client, pid, productId]);

  if (!pid) return null;
  if (!validPid(pid)) return <div className="payment-return-alert" role="alert">決済情報を確認できませんでした。</div>;
  if (!state || state.pid !== pid) {
    return <div aria-live="polite" className="payment-return-alert payment-return-alert--loading" role="status">決済状況を確認しています。</div>;
  }
  return <div className="payment-return-alert" role="alert">{state.message}</div>;
}
