import Link from "next/link";
import { PageTitle } from "@/components/common/page-title";
import { PageContainer } from "@/components/layout/page-container";

export default function RegisterPage() {
  return (
    <PageContainer className="route-page" size="narrow">
      <PageTitle description="登録処理はPlatformの確定Contractへ接続する後続Taskで実装します。" eyebrow="JOIN LUXE PACK" title="新規登録" />
      <section className="auth-placeholder">
        <p>新規登録機能は現在準備中です。</p>
        <span>--</span>
        <Link href="/login">すでにアカウントをお持ちの方</Link>
      </section>
    </PageContainer>
  );
}
