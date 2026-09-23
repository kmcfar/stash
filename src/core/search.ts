import MiniSearch, { type SearchResult } from 'minisearch';
import { displayTitle, type Link } from './types';

interface SearchDoc {
  id: string;
  title: string;
  summary: string;
  why: string;
  tags: string;
  keywords: string;
  collection: string;
  site: string;
  url: string;
}

const FIELDS: (keyof SearchDoc)[] = [
  'title',
  'summary',
  'why',
  'tags',
  'keywords',
  'collection',
  'site',
  'url',
];

const OPTIONS = {
  fields: FIELDS,
  storeFields: [] as string[],
  searchOptions: {
    boost: { title: 3, keywords: 2, tags: 2, collection: 1.5, site: 1.2 },
    prefix: true,
    fuzzy: 0.2,
    combineWith: 'AND' as const,
  },
};

export type LinkIndex = MiniSearch<SearchDoc>;

export function toSearchDoc(link: Link): SearchDoc {
  return {
    id: link.id,
    title: displayTitle(link),
    summary: link.summary || link.description,
    why: link.why ?? '',
    tags: link.tags.join(' '),
    keywords: link.keywords.join(' '),
    collection: link.collection,
    site: link.site,
    url: link.url.replace(/^https?:\/\/(www\.)?/, ''),
  };
}

export function createIndex(links: Link[]): LinkIndex {
  const index = new MiniSearch<SearchDoc>(OPTIONS);
  index.addAll(links.filter((l) => !l.archived).map(toSearchDoc));
  return index;
}

export function upsertInIndex(index: LinkIndex, link: Link): void {
  if (index.has(link.id)) index.discard(link.id);
  if (!link.archived) index.add(toSearchDoc(link));
}

export function removeFromIndex(index: LinkIndex, id: string): void {
  if (index.has(id)) index.discard(id);
}

export function serializeIndex(index: LinkIndex): string {
  return JSON.stringify(index);
}

export function loadIndex(json: string): LinkIndex {
  return MiniSearch.loadJSON<SearchDoc>(json, OPTIONS);
}

/** Small nudge for links you actually use; text relevance still dominates. */
function usageBoost(link: Link | undefined, now: number): number {
  if (!link) return 1;
  const opens = Math.log2(2 + link.openCount) / 4;
  const lastTouched = link.lastOpenedAt ?? link.createdAt;
  const ageDays = (now - lastTouched) / 86_400_000;
  const recency = ageDays < 7 ? 0.15 : ageDays < 30 ? 0.05 : 0;
  return 1 + opens + recency + (link.pinned ? 0.2 : 0);
}

export function searchLinks(
  index: LinkIndex,
  query: string,
  byId: Map<string, Link>,
  limit = 30,
  now = Date.now(),
): Link[] {
  const q = query.trim();
  if (!q) return [];
  let results: SearchResult[] = index.search(q, {
    boostDocument: (id) => usageBoost(byId.get(String(id)), now),
  });
  if (results.length === 0) {
    results = index.search(q, { combineWith: 'OR' });
  }
  const out: Link[] = [];
  for (const r of results) {
    const link = byId.get(String(r.id));
    if (link && !link.archived) out.push(link);
    if (out.length === limit) break;
  }
  return out;
}

/** Loose recall-oriented search used to pick candidates for AI ranking. */
export function askCandidates(
  index: LinkIndex,
  question: string,
  byId: Map<string, Link>,
  limit: number,
): Link[] {
  const results = index.search(question, { combineWith: 'OR', fuzzy: 0.3, prefix: true });
  const out: Link[] = [];
  for (const r of results) {
    const link = byId.get(String(r.id));
    if (link && !link.archived) out.push(link);
    if (out.length === limit) break;
  }
  if (out.length < limit) {
    const seen = new Set(out.map((l) => l.id));
    const recent = [...byId.values()]
      .filter((l) => !l.archived && !seen.has(l.id))
      .sort((a, b) => b.createdAt - a.createdAt);
    out.push(...recent.slice(0, limit - out.length));
  }
  return out;
}
