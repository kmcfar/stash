import { type Enrichment, KINDS, type Kind } from './types';

/**
 * Model output is derived from untrusted page content, so every field is
 * treated as hostile: type-checked, stripped of control characters and markup,
 * and length-capped. Anything unusable is rejected rather than repaired.
 */

const LIMITS = {
  title: 120,
  summary: 280,
  why: 160,
  collection: 40,
  tag: 30,
  keyword: 30,
  tags: 4,
  keywords: 8,
};

// biome-ignore lint/suspicious/noControlCharactersInRegex: stripping control characters is the point
const UNSAFE_CHARS = /[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e]/g;

export function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/<[^>]*>/g, '')
    .replace(UNSAFE_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max)
    .trim();
}

export function cleanCollectionName(value: unknown): string {
  const text = cleanText(value, LIMITS.collection).replace(/[/\\]/g, '-');
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function cleanList(value: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    const text = cleanText(item, maxLen).toLowerCase();
    if (text && !seen.has(text)) {
      seen.add(text);
      out.push(text);
    }
    if (out.length === maxItems) break;
  }
  return out;
}

/**
 * Prefer an existing collection when the model returns a near-duplicate
 * ("docs" vs "Docs", "Dashboard" vs "Dashboards").
 */
export function snapToExisting(name: string, existing: string[]): string {
  const key = (s: string) =>
    s
      .toLowerCase()
      .replace(/s$/, '')
      .replace(/[^a-z0-9]/g, '');
  const match = existing.find((e) => key(e) === key(name));
  return match ?? name;
}

export function validateEnrichment(raw: unknown, existingCollections: string[]): Enrichment | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const title = cleanText(r.title, LIMITS.title);
  const summary = cleanText(r.summary, LIMITS.summary);
  const collection = cleanCollectionName(r.collection);
  if (!title || !summary || !collection) return null;
  const kind: Kind = KINDS.includes(r.kind as Kind) ? (r.kind as Kind) : 'other';
  return {
    title,
    summary,
    kind,
    collection: snapToExisting(collection, existingCollections),
    tags: cleanList(r.tags, LIMITS.tags, LIMITS.tag),
    keywords: cleanList(r.keywords, LIMITS.keywords, LIMITS.keyword),
    why: cleanText(r.why, LIMITS.why),
  };
}

/** Ranking output may only reference links that actually exist. */
export function validateRankedIds(raw: unknown, allowed: Set<string>, max = 10): string[] {
  const ids = raw && typeof raw === 'object' ? (raw as { ids?: unknown }).ids : raw;
  if (!Array.isArray(ids)) return [];
  const out: string[] = [];
  for (const id of ids) {
    if (typeof id === 'string' && allowed.has(id) && !out.includes(id)) out.push(id);
    if (out.length === max) break;
  }
  return out;
}

export function validateDescription(raw: unknown): string {
  const value =
    raw && typeof raw === 'object' ? (raw as { description?: unknown }).description : raw;
  return cleanText(value, 140);
}
