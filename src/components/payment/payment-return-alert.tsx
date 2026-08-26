"use client";

import { useEffect, useState } from "react";
import type { PaymentClientAdapter } from "@/lib/platform";

type ReturnState =
  | { readonly pid: string; readonly status: "redirecting" }
  | { readonly message: string; readonly pid: string; readonly status: "alert" };

const replaceLocation = (url: string) => window.location.replace(url);

function validPid(pid: string) {
  return pid.length > 0 && pid.length <= 128 && !pid.includes("/") && !pid.includes("\0");
}

export function PaymentReturnAlert({
  client,
  pid,
  productId,
  replace = replaceLocation,
}: {
  readonly client: PaymentClientAdapter;
  readonly pid: string | null;
  readonly productId: string;
  readonly replace?: (url: string) => void;
}) {
  const [state, setState] = useState<ReturnState | null>(null);

  useEffect(() => {
    if (!pid || !validPid(pid)) return;
    let active = true;
    void client.getPayment(pid)
      .then(({ data: payment }) => {
        if (!active) return;
        if (payment.point_product_id && payment.point_product_id !== productId) {
          setState({ message: "決済情報を確認できませんでした。", pid, status: "alert" });
          return;
        }
        if (["succeeded", "created", "requires_action", "processing"].includes(payment.status)) {
          setState({ pid, status: "redirecting" });
          replace(`/points/purchase/thanks?pid=${encodeURIComponent(payment.id)}`);
          return;
        }
        if (payment.status === "failed") {
          setState({ message: "決済が失敗しました。", pid, status: "alert" });
        } else if (payment.status === "canceled") {
          setState({ message: "決済をキャンセルしました。", pid, status: "alert" });
        } else {
          setState({ message: "決済の有効期限が切れました。", pid, status: "alert" });
        }
      })
      .catch(() => {
        if (active) setState({ message: "決済情報を確認できませんでした。", pid, status: "alert" });
      });
    return () => { active = false; };
  }, [client, pid, productId, replace]);

  if (!pid) return null;
  if (!validPid(pid)) return <div className="payment-return-alert" role="alert">決済情報を確認できませんでした。</div>;
  if (!state || state.pid !== pid || state.status === "redirecting") {
    return <div aria-live="polite" className="payment-return-alert payment-return-alert--loading" role="status">決済状況を確認しています。</div>;
  }
  return <div className="payment-return-alert" role="alert">{state.message}</div>;
}
