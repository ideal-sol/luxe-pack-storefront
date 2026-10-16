export function PreRegisterNote({ items }: { readonly items: readonly string[] }) {
  return (
    <aside aria-labelledby="pre-note-heading" className="pre-note">
      <h2 id="pre-note-heading">ご注意</h2>
      <ul>
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </aside>
  );
}
