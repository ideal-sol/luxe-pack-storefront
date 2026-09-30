"use client";

import { useEffect } from "react";

/** スクロールで順に現れる対象（デザインの「各ブロックはスクロールに合わせて順に現れる」）。 */
const revealSelector = [
  ".gacha-card",
  ".home-guide__plan",
  ".home-guide__paybox",
  ".home-guide__flow li",
  ".home-guide__safes li",
  ".point-product-card",
  ".prize-rank",
  ".mypage-shortcuts a",
  ".notice-list",
].join(", ");

/**
 * 全画面共通の動き（見た目のみ）。
 * - スクロールに合わせてブロックを順に表示する
 * - ガチャカードをマウスに追従して傾け、画像に光沢を出す
 * OSの「動きを減らす」設定では何もしない。React が管理しない data 属性と CSS 変数だけを書き換える。
 */
export function MotionEffects() {
  useEffect(() => {
    const motion = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    if (motion?.matches) return;
    const root = document.documentElement;
    root.dataset.motion = "ready";

    let revealObserver: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      revealObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.reveal = "in";
          revealObserver?.unobserve(entry.target);
        }
      }, { rootMargin: "0px 0px -8% 0px", threshold: 0 });
    }
    const prepare = (scope: ParentNode) => {
      if (!revealObserver) return;
      scope.querySelectorAll<HTMLElement>(revealSelector).forEach((element, index) => {
        if (element.dataset.reveal) return;
        element.dataset.reveal = "wait";
        element.style.setProperty("--reveal-delay", `${(index % 3) * 0.08}s`);
        revealObserver?.observe(element);
      });
    };
    prepare(document);
    const mutations = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.matches(revealSelector)) prepare(node.parentElement ?? document);
          else prepare(node);
        });
      }
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    const onPointerMove = (event: PointerEvent) => {
      if (motion?.matches || event.pointerType !== "mouse") return;
      const card = (event.target as Element | null)?.closest<HTMLElement>(".gacha-card");
      if (!card) return;
      const rect = card.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width;
      const y = (event.clientY - rect.top) / rect.height;
      card.dataset.tilt = "on";
      card.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
      card.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
      card.style.setProperty("--ry", `${((x - 0.5) * 6).toFixed(2)}deg`);
      card.style.setProperty("--rx", `${((0.5 - y) * 4).toFixed(2)}deg`);
    };
    const onPointerOut = (event: PointerEvent) => {
      const card = (event.target as Element | null)?.closest<HTMLElement>(".gacha-card");
      if (!card || card.contains(event.relatedTarget as Node | null)) return;
      delete card.dataset.tilt;
    };
    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerout", onPointerOut, { passive: true });

    const stopForReducedMotion = () => {
      if (!motion?.matches) return;
      delete root.dataset.motion;
      revealObserver?.disconnect();
      mutations.disconnect();
      document.querySelectorAll<HTMLElement>("[data-tilt]").forEach((card) => { delete card.dataset.tilt; });
    };
    motion?.addEventListener("change", stopForReducedMotion);

    return () => {
      motion?.removeEventListener("change", stopForReducedMotion);
      delete root.dataset.motion;
      revealObserver?.disconnect();
      mutations.disconnect();
      document.querySelectorAll<HTMLElement>("[data-reveal]").forEach((element) => {
        delete element.dataset.reveal;
        element.style.removeProperty("--reveal-delay");
      });
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerout", onPointerOut);
    };
  }, []);

  return null;
}
