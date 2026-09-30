/**
 * ライブ感の帯（デザイン top.html の「ただいま○人が閲覧中／本日の開封／完売企画の当選報告」）。
 * 表示には実データが必要。デザインの数字は表示例のため、実データの仕組みができるまで非表示にする。
 */
export const homeLiveBandEnabled = false;

export interface HomeLiveBandReport {
  readonly gachaTitle: string;
  readonly prizeName: string;
  readonly ago: string;
}

export interface HomeLiveBandProps {
  readonly viewers: number;
  readonly openedToday: number;
  readonly reports: readonly HomeLiveBandReport[];
}

const number = new Intl.NumberFormat("ja-JP");

export function HomeLiveBand({ openedToday, reports, viewers }: HomeLiveBandProps) {
  const feed = (hidden: boolean) => reports.map((report) => (
    <span aria-hidden={hidden || undefined} className="home-live__item" key={`${hidden ? "r-" : ""}${report.gachaTitle}-${report.prizeName}-${report.ago}`}>
      <span className="home-live__chip">完売</span>
      {report.gachaTitle} <b>{report.prizeName}</b><i>{report.ago}</i>
    </span>
  ));
  return (
    <div aria-label="ただいまの状況" className="home-live" role="region">
      <div className="page-container home-live__inner">
        <p className="home-live__stat"><span aria-hidden="true" className="home-live__dot" />ただいま<strong>{number.format(viewers)}</strong><em>人が閲覧中</em></p>
        <p className="home-live__stat">本日の開封<strong>{number.format(openedToday)}</strong><em>口</em></p>
        <div className="home-live__feed"><div className="home-live__track">{feed(false)}{feed(true)}</div></div>
      </div>
    </div>
  );
}
