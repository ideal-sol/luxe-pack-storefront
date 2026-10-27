import type { Payment, PaymentMethod } from "@/lib/platform";

const number = new Intl.NumberFormat("ja-JP");
const dateTime = new Intl.DateTimeFormat("ja-JP", {
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
  minute: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Tokyo",
  year: "numeric",
});

const paymentMethodLabels: Record<string, string> = {
  credit_card: "クレジットカード",
  konbini: "コンビニ決済",
  paypay: "PayPay",
  virtual_account: "銀行振込",
  netridecash: "電子マネー（NetRideCash）",
  paidy: "あと払い（ペイディ）",
};

export function formatPaymentAmount(payment: Payment) {
  return `${number.format(payment.amount.amount)}円`;
}

export function formatPaymentCoins(value: number) {
  return `${number.format(value)}コイン`;
}

export function formatPaymentDate(value: string) {
  return dateTime.format(new Date(value));
}

export function paymentMethodLabel(method: PaymentMethod | string, label?: string) {
  return label || paymentMethodLabels[method] || "お支払い";
}
