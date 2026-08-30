import type { Metadata } from "next";
import { AccountSecurityLinkRouter } from "@/components/account-security/account-security-link-router";

export const metadata: Metadata = { referrer: "no-referrer" };

export default function EmailChangeVerificationPage() {
  return <AccountSecurityLinkRouter expectedKind="email-change" />;
}
