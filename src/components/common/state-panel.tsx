import Link from "next/link";

interface StatePanelProps {
  readonly action?: { readonly href: string; readonly label: string };
  readonly description: string;
  readonly eyebrow?: string;
  readonly title: string;
  readonly tone?: "default" | "error";
}

function StatePanel({
  action,
  description,
  eyebrow = "STATUS",
  title,
  tone = "default",
}: StatePanelProps) {
  return (
    <section className={`state-panel state-panel--${tone}`}>
      <div className="state-panel__mark" aria-hidden="true">
        <span />
      </div>
      <p className="state-panel__eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <p>{description}</p>
      {action ? (
        <Link className="button button--dark" href={action.href}>
          {action.label}
        </Link>
      ) : null}
    </section>
  );
}

export function EmptyState() {
  return (
    <StatePanel
      description="表示できる情報はまだありません。Platform接続後にここへ反映されます。"
      eyebrow="EMPTY"
      title="準備中です"
    />
  );
}

export function ErrorState() {
  return (
    <StatePanel
      action={{ href: "/", label: "ホームへ戻る" }}
      description="時間をおいてから、もう一度お試しください。"
      eyebrow="ERROR"
      title="情報を表示できませんでした"
      tone="error"
    />
  );
}

export function LoginRequiredState() {
  return (
    <StatePanel
      action={{ href: "/login", label: "ログインへ" }}
      description="このページの情報を確認するにはログインが必要です。"
      eyebrow="MEMBERS ONLY"
      title="ログインしてください"
    />
  );
}
