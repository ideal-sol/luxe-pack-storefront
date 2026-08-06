interface PageTitleProps {
  readonly description?: string;
  readonly eyebrow?: string;
  readonly title: string;
}

export function PageTitle({ description, eyebrow, title }: PageTitleProps) {
  return (
    <header className="page-title">
      {eyebrow ? <p className="page-title__eyebrow">{eyebrow}</p> : null}
      <h1>{title}</h1>
      {description ? <p className="page-title__description">{description}</p> : null}
    </header>
  );
}
