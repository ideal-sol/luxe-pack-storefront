"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FirstBuyOffer } from "@/lib/presentation/first-buy-layout";
import { FirstBuyActiveCard, FirstBuyHero, firstBuyRegionLabel } from "./first-buy-offer";
import { firstBuyLayoutHref } from "@/lib/presentation/first-buy-layout";

/*
 * トップの 24時間限定コイン割引（デザイン 2026-10-02 の ② 大枠 と ④ ポップアップ）。
 * 表示のみ。今回は固定presentation stateを受け取る。自動表示・1回限り判定・永続化は実装しない。
 */

type ActiveOffer = FirstBuyOffer;

const focusableSelector = "a[href], button:not([disabled])";

/**
 * ④ ポップアップ。大枠と同じカードを、暗くした背景の上に重ねる。
 * 右上の「×」／「あとで見る」／背景／Esc のどれでも閉じられる。
 */
function FirstBuyModal({ offer, onClose }: { readonly offer: ActiveOffer; readonly onClose: () => void }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    document.body.classList.add("fb-modal-open");
    closeRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      // 開いている間は、キーボードの移動をポップアップの中に留める。
      const focusable = Array.from(boxRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !boxRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !boxRef.current?.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.classList.remove("fb-modal-open");
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div
      aria-label={firstBuyRegionLabel}
      aria-modal="true"
      className="fb-modal"
      onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
      role="dialog"
    >
      <div className="fb-modal__box" ref={boxRef}>
        <button aria-label="閉じる" className="fb-modal__close" onClick={onClose} ref={closeRef} type="button">×</button>
        <FirstBuyActiveCard ctaHref={firstBuyLayoutHref("/points", offer.state)} offer={offer} onCtaClick={onClose} />
        <button className="fb-modal__later" onClick={onClose} type="button">あとで見る</button>
      </div>
    </div>
  );
}

/** Popup is explicitly requested for review. Dismissal lives only in this mount. */
export function HomeFirstBuy({ offer, showPopup = false }: { readonly offer: FirstBuyOffer; readonly showPopup?: boolean }) {
  const [open, setOpen] = useState(showPopup);
  const close = useCallback(() => setOpen(false), []);
  return (
    <>
      <FirstBuyHero offer={offer} placement="home" />
      {offer.state === "active" && open ? <FirstBuyModal offer={offer} onClose={close} /> : null}
    </>
  );
}
