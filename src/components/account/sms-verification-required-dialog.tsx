"use client";

import { useRouter } from "next/navigation";
import { ConfirmationDialog } from "@/components/common/confirmation-dialog";
import { smsVerificationRoute } from "@/lib/routes/navigation";

export function SmsVerificationRequiredDialog({
  context,
  onCancel,
  open,
}: {
  readonly context: "address" | "shipping";
  readonly onCancel: () => void;
  readonly open: boolean;
}) {
  const router = useRouter();
  const address = context === "address";
  return (
    <ConfirmationDialog
      confirmLabel="SMS認証する"
      description={address ? "お届け先の登録・変更・削除にはSMS認証が必要です。" : "配送依頼にはSMS認証が必要です。"}
      onCancel={onCancel}
      onConfirm={() => router.push(smsVerificationRoute)}
      open={open}
      title={address ? "お届け先の登録にはSMS認証が必要です" : "配送依頼にはSMS認証が必要です"}
    />
  );
}
