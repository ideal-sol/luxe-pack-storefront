"use client";

import Link from "next/link";
import { useState } from "react";
import { informationNavigation } from "@/lib/routes/navigation";

/**
 * トップ右下に出るオリカの案内吹き出し（デザインの「オリカの吹き出し」）。
 * 閉じるとトップを表示している間は再表示しない（ブラウザ保存は使わない）。
 * 狭い画面（600px以下）ではCSSで非表示にする。
 */
export function HomeAssist() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <aside aria-label="ご案内" className="home-assist">
      <p className="home-assist__bubble">
        迷ったら、まずは<Link href={informationNavigation[0].href}>はじめての方へ</Link>をご覧ください。
      </p>
      {/* eslint-disable-next-line @next/next/no-img-element -- 固定のブランド素材は静的配信のみで最適化不要 */}
      <img alt="" aria-hidden="true" className="home-assist__character" height={208} src="/brand/sd_orika_egao.webp" width={153} />
      <button aria-label="ご案内を閉じる" className="home-assist__close" onClick={() => setDismissed(true)} type="button">×</button>
    </aside>
  );
}
