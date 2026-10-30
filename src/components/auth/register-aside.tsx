import { brandAssetUrl } from "@/lib/brand-assets";

/**
 * 会員登録の右ペイン（デザイン 08_会員登録.html の右側の2つのパネル）。
 * 狭い画面では入力フォームの下に並ぶ。
 */
export function RegisterAside() {
  return (
    <aside aria-label="ご登録について" className="register-aside">
      <section aria-labelledby="register-benefit-title" className="register-aside__panel register-aside__panel--benefit">
        {/* eslint-disable-next-line @next/next/no-img-element -- 固定のブランド素材は静的配信のみで最適化不要 */}
        <img alt="" aria-hidden="true" className="register-aside__character" height={130} src={brandAssetUrl("sd_orika_egao.webp")} width={96} />
        <h2 id="register-benefit-title">ご登録でもらえるもの</h2>
        <dl className="register-aside__list">
          <div><dt>新規登録限定ガチャ</dt><dd>1回無料</dd></div>
          <div><dt>ログインボーナスガチャ</dt><dd>毎日1回無料</dd></div>
        </dl>
        <p className="register-aside__note">ご登録は無料です。コインを購入しない限り費用はかかりません。</p>
      </section>
      <section aria-labelledby="register-age-title" className="register-aside__panel">
        <h2 id="register-age-title">ご利用は18歳以上の方に限ります</h2>
        <p className="register-aside__note">18歳未満の方はご登録いただけません。18歳以上20歳未満の方は、保護者の方の同意が必要です。</p>
      </section>
    </aside>
  );
}
