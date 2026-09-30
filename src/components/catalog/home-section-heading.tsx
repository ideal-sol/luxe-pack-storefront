/**
 * トップの節の見出し（デザイン top.html の .sec-h）。
 * 中央寄せの見出し＋黄色のマーカー、背景の薄い英字、左右の飾り線、説明文、下のバー。
 */
export function HomeSectionHeading({
  children,
  id,
  lead,
  title,
  watermark,
}: {
  readonly children?: React.ReactNode;
  readonly id: string;
  readonly lead?: string;
  readonly title: string;
  readonly watermark: string;
}) {
  return (
    <div className="home-section-heading">
      <span aria-hidden="true" className="home-section-heading__watermark">{watermark}</span>
      <h2 id={id}>
        {title}
        <span aria-hidden="true" className="home-section-heading__wing home-section-heading__wing--left" />
        <span aria-hidden="true" className="home-section-heading__wing home-section-heading__wing--right" />
      </h2>
      {children}
      {lead && <p>{lead}</p>}
      <span aria-hidden="true" className="home-section-heading__bar" />
    </div>
  );
}
