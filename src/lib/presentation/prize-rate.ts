/**
 * Platform が返す提供割合（ppm：100万分率）を、% の表記にする。
 * 1 ppm ＝ 0.0001% なので、小数第4位までで過不足なく表せる。計算ではなく単位の書き換えだけを行う。
 */
export function formatPpmAsPercent(ppm: number): string {
  const safe = Math.max(0, Math.trunc(ppm));
  const whole = Math.floor(safe / 10_000);
  const fraction = String(safe % 10_000).padStart(4, "0");
  return `${whole}.${fraction}%`;
}
