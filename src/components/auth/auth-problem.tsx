import type { AuthProblemPresentation } from "@/lib/platform";

export function AuthProblem({ problem }: { readonly problem: AuthProblemPresentation | null }) {
  if (!problem) return null;
  return (
    <div className="auth-problem" role="alert">
      <strong>手続きを完了できませんでした</strong>
      <p>{problem.message}</p>
    </div>
  );
}

export function FieldProblem({
  field,
  problem,
}: {
  readonly field: string;
  readonly problem: AuthProblemPresentation | null;
}) {
  const messages = problem?.fieldErrors[field];
  if (!messages?.length) return null;
  return <p className="form-field__error">{messages[0]}</p>;
}
