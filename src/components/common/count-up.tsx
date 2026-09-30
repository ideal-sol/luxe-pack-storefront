"use client";

import { useEffect, useRef, useState } from "react";

const formatter = new Intl.NumberFormat("ja-JP");

/**
 * 画面に入ったときに 0 から数え上がる数字（デザインの「数字は0から数え上がる」）。
 * 最初の描画・動きを減らす設定・IntersectionObserver 非対応では最終値をそのまま出す。
 */
export function CountUp({ value, durationMs = 1000 }: { readonly value: number; readonly durationMs?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [shown, setShown] = useState(value);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === "undefined") return;
    const motion = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    if (motion?.matches) return;
    let frame = 0;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) {
        // 画面外にある間は 0 にしておき、入ってきたら数え上げる
        setShown(0);
        return;
      }
      observer.disconnect();
      const started = performance.now();
      const step = (now: number) => {
        const progress = Math.min(1, (now - started) / durationMs);
        setShown(Math.round(value * (1 - Math.pow(1 - progress, 3))));
        if (progress < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }, { threshold: 0.3 });
    const stopForReducedMotion = () => {
      if (!motion?.matches) return;
      observer.disconnect();
      cancelAnimationFrame(frame);
      setShown(value);
    };
    motion?.addEventListener("change", stopForReducedMotion);
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      motion?.removeEventListener("change", stopForReducedMotion);
      setShown(value);
    };
  }, [durationMs, value]);

  return <span className="count-up" ref={ref}>
    <span className="count-up__accessible">{formatter.format(value)}</span>
    <span aria-hidden="true" className="count-up__visual" data-count={formatter.format(shown)} />
  </span>;
}
