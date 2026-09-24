/** Trim extracted page text to a token budget without cutting mid-word. */
export function trimPageText(text: string, maxChars: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= maxChars) return clean;
  const cut = clean.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > maxChars * 0.8 ? cut.slice(0, lastSpace) : cut).trim();
}

export function relativeTime(ts: number, now = Date.now()): string {
  const minutes = Math.round((now - ts) / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.round(months / 12)}y ago`;
}

const MAX_DESCRIPTION = 160;

/** Cut to a length limit, ending on a sentence or word boundary. */
function shorten(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const sentence = cut.search(/[.!?](?=\s[^.!?]*$)/);
  if (sentence > max * 0.5) return cut.slice(0, sentence + 1);
  const space = cut.lastIndexOf(' ');
  return `${cut.slice(0, space > max * 0.6 ? space : max).replace(/[,;:—–-]$/, '')}…`;
}

/**
 * A short, human description without AI: the page's own meta description if
 * it's useful, else Readability's excerpt, else the opening of the main text.
 * Descriptions that just repeat the title are skipped.
 */
export function pickDescription(
  title: string,
  candidates: (string | undefined)[],
  max = MAX_DESCRIPTION,
): string {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const titleKey = norm(title);
  for (const candidate of candidates) {
    const text = candidate?.replace(/\s+/g, ' ').trim() ?? '';
    if (text.length < 25) continue;
    if (titleKey && norm(text) === titleKey) continue;
    return shorten(text, max);
  }
  return '';
}
