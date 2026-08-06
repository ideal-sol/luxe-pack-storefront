export function LoadingState() {
  return (
    <div aria-live="polite" className="loading-state" role="status">
      <span className="loading-state__spinner" aria-hidden="true" />
      <span>読み込み中</span>
    </div>
  );
}
