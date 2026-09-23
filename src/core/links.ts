import type { Link, SaveContext } from './types';
import { normalizeUrl, parseUrl, sanitizeUrl, siteOf } from './url';
import { cleanText } from './validate';

export interface NewLinkInput {
  url: string;
  title?: string;
  description?: string;
  favicon?: string;
  pageText?: string;
  context?: SaveContext;
  collection?: string;
  source?: Link['source'];
  createdAt?: number;
}

export function newId(): string {
  return crypto.randomUUID();
}

/** Collection used when no AI is available: group by site. */
export function heuristicCollection(url: string): string {
  const site = siteOf(url);
  const host = site.split('/')[0] ?? site;
  if (site.includes('/')) return site;
  const parts = host.split('.');
  const main = parts.length > 2 ? parts.slice(-2).join('.') : host;
  return main;
}

export function heuristicWhy(context: SaveContext): string {
  const parts: string[] = [];
  const ref = context.referrer ? parseUrl(context.referrer) : null;
  if (ref) parts.push(`Saved from ${ref.hostname.replace(/^www\./, '')}`);
  else if (context.openerTitle) parts.push(`Opened from “${context.openerTitle}”`);
  if (context.tabGroup) parts.push(`in group “${context.tabGroup}”`);
  return parts.join(' · ');
}

export function createLink(input: NewLinkInput, now = Date.now()): Link {
  const url = sanitizeUrl(input.url);
  const context = input.context ?? {};
  return {
    id: newId(),
    url,
    normalizedUrl: normalizeUrl(url),
    title: cleanText(input.title, 300) || url,
    description: cleanText(input.description, 500),
    favicon: input.favicon,
    site: siteOf(url),
    pageText: input.pageText,
    keywords: [],
    context,
    why: heuristicWhy(context) || undefined,
    tags: [],
    collection: input.collection || heuristicCollection(url),
    pinned: false,
    archived: false,
    createdAt: input.createdAt ?? now,
    openCount: 0,
    source: input.source ?? 'capture',
    aiStatus: 'none',
    aiAttempts: 0,
  };
}

/** Re-saving a known URL refreshes metadata but keeps history and AI results. */
export function mergeResave(existing: Link, incoming: Link): Link {
  return {
    ...existing,
    title: incoming.title || existing.title,
    description: incoming.description || existing.description,
    favicon: incoming.favicon ?? existing.favicon,
    pageText: incoming.pageText ?? existing.pageText,
    context: { ...existing.context, ...incoming.context },
    archived: false,
  };
}
