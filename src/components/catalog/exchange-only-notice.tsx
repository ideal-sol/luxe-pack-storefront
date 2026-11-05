/** Names are presentation input, supplied by the formal Platform classification. */
export function ExchangeOnlyNotice({ names }: { readonly names: readonly string[] }) {
  if (names.length === 0) return null;
  return <section aria-label="コイン交換限定景品の注意事項">
    <p>「コイン交換限定」の景品は、獲得後にコインへの交換のみ行えます（発送はできません）。</p>
    <ul>{names.map((name, index) => <li key={`${index}:${name}`}>{name}</li>)}</ul>
  </section>;
}
