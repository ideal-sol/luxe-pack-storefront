import sanitizeHtml from "sanitize-html";

const allowedTags = [
  "a",
  "blockquote",
  "br",
  "em",
  "h2",
  "h3",
  "h4",
  "hr",
  "li",
  "ol",
  "p",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
] as const;

function safeHref(value: string | undefined) {
  if (!value) return null;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "mailto:" ? value : null;
  } catch {
    return null;
  }
}

export function sanitizeCanonicalContent(value: string) {
  return sanitizeHtml(value, {
    allowedAttributes: {
      a: ["href", "rel", "target", "title"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan", "scope"],
    },
    allowedSchemes: ["https", "mailto"],
    allowedSchemesAppliedToAttributes: ["href"],
    allowedTags: [...allowedTags],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    transformTags: {
      a: (_, attributes) => {
        const href = safeHref(attributes.href);
        if (!href) return { tagName: "span", attribs: {} };
        const external = href.startsWith("https://");
        return {
          tagName: "a",
          attribs: {
            href,
            ...(attributes.title ? { title: attributes.title } : {}),
            ...(external ? { rel: "noopener noreferrer", target: "_blank" } : {}),
          },
        };
      },
      h1: "h2",
    },
  });
}

export function SafeContent({ html }: { readonly html: string }) {
  const sanitized = sanitizeCanonicalContent(html);
  return <div className="safe-content" dangerouslySetInnerHTML={{ __html: sanitized }} />;
}
