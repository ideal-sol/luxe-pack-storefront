import Link from "next/link";
import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";

export default function LoginPage() {
  return (
    <PageContainer className="route-page" size="narrow">
      <PageTitle description="認証フォームはPlatformの確定Contractへ接続する後続Taskで実装します。" eyebrow="WELCOME BACK" title="ログイン" />
      <section className="auth-placeholder">
        <p>ログイン機能は現在準備中です。</p>
        <span>--</span>
        <Link href="/register">アカウントをお持ちでない方</Link>
      </section>
    </PageContainer>
  );
}
