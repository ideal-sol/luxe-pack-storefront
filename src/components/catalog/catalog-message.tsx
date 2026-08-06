export function CatalogMessage({
  action,
  description,
  eyebrow,
  title,
  tone = "default",
}: {
  readonly action?: () => void;
  readonly description: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly tone?: "default" | "error";
}) {
  return (
    <section className={`catalog-message catalog-message--${tone}`}>
      <p>{eyebrow}</p>
      <h2>{title}</h2>
      <span>{description}</span>
      {action && <button className="button button--ghost" onClick={action} type="button">再読み込み</button>}
    </section>
  );
}

export function CatalogLoading({ label = "公開情報を読み込み中" }: { readonly label?: string }) {
  return (
    <div aria-live="polite" className="catalog-loading" role="status">
      <span aria-hidden="true" />
      <p>{label}</p>
    </div>
  );
}
