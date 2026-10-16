import type { Metadata } from "next";
import "@/styles/pre-register.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
};

export default function PreRegisterLayout({ children }: { readonly children: React.ReactNode }) {
  return children;
}
