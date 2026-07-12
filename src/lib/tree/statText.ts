// GGG's stat display strings carry `[Token|Display Text]` markup (show the
// display text, drop the internal token) and occasionally `[Word]` with no
// pipe (show the word itself) or `<tag>`/`{text}` wrappers around a granted
// skill name. Verified against real 0.5.2 node data — see examples in the
// call sites. Rendered as plain text; no in-tooltip icons/links for now.
export function parseStatText(raw: string): string {
  return raw
    .replace(/\[([^|\]]+)\|([^\]]+)\]/g, '$2')
    .replace(/\[([^\]]+)\]/g, '$1')
    .replace(/<\/?[a-zA-Z]+>/g, '')
    .replace(/\{([^}]+)\}/g, '$1');
}
