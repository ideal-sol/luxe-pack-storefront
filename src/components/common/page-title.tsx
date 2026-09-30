interface PageTitleProps {
  readonly description?: string;
  readonly eyebrow?: string;
  readonly title: string;
}

/** 見出し帯のぼけ玉（位置・大きさ・周期はデザインの _作り込み.js と同じ規則で固定値にしている）。 */
const titleBokeh = Array.from({ length: 10 }, (_, index) => ({
  delay: index * 1.1,
  duration: 8 + (index % 5) * 2.2,
  left: (index * 10.4) % 97,
  size: 5 + ((index * 7) % 16),
}));

export function PageTitle({ description, eyebrow, title }: PageTitleProps) {
  return (
    <header className="page-title">
      <div aria-hidden="true" className="page-title__layer page-title__dots" />
      <div aria-hidden="true" className="page-title__layer page-title__rays" />
      <div aria-hidden="true" className="page-title__layer page-title__holo"><i /><i /></div>
      <div aria-hidden="true" className="page-title__layer page-title__bokeh">
        {titleBokeh.map((item) => (
          <i
            key={item.left}
            style={{ animationDelay: `${item.delay}s`, animationDuration: `${item.duration}s`, height: item.size, left: `${item.left}%`, width: item.size }}
          />
        ))}
      </div>
      <div className="page-title__content">
        {eyebrow ? <p className="page-title__eyebrow">{eyebrow}</p> : null}
        <h1>{title}</h1>
        {description ? <p className="page-title__description">{description}</p> : null}
      </div>
      <svg aria-hidden="true" className="page-title__wave" preserveAspectRatio="none" viewBox="0 0 1440 34">
        <path d="M0,18 C170,34 300,2 470,10 C640,18 760,34 920,27 C1080,20 1250,1 1440,11 L1440,34 L0,34 Z" />
      </svg>
    </header>
  );
}
