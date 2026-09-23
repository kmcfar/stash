import type { NewLinkInput } from './links';
import type { Link } from './types';
import { displayTitle } from './types';
import { isOpenable } from './url';
import { cleanCollectionName } from './validate';

export const SCHEMA_VERSION = 1;

/** Minimal shape of chrome.bookmarks.BookmarkTreeNode, so this stays pure. */
export interface BookmarkNode {
  id: string;
  title: string;
  url?: string;
  dateAdded?: number;
  children?: BookmarkNode[];
}

const ROOT_FOLDERS = new Set([
  '',
  'Bookmarks bar',
  'Bookmarks Bar',
  'Other bookmarks',
  'Mobile bookmarks',
]);

/**
 * Flatten a bookmarks tree. The nearest named folder becomes the collection.
 * `skipFolderId` lets us ignore Stash's own mirror folder.
 */
export function bookmarksToInputs(roots: BookmarkNode[], skipFolderId?: string): NewLinkInput[] {
  const out: NewLinkInput[] = [];
  const walk = (node: BookmarkNode, folder: string) => {
    if (node.id === skipFolderId) return;
    if (node.url) {
      if (!isOpenable(node.url)) return;
      out.push({
        url: node.url,
        title: node.title,
        collection: cleanCollectionName(folder) || undefined,
        source: 'import',
        createdAt: node.dateAdded,
      });
      return;
    }
    const name = ROOT_FOLDERS.has(node.title) ? folder : node.title;
    for (const child of node.children ?? []) walk(child, name);
  };
  for (const root of roots) walk(root, '');
  return out;
}

export function exportJson(links: Link[]): string {
  const clean = links.map(({ pageText: _pageText, ...rest }) => rest);
  return JSON.stringify({ app: 'stash', schemaVersion: SCHEMA_VERSION, links: clean }, null, 2);
}

/** Accepts our own export format; anything invalid is skipped. */
export function importJson(json: string): NewLinkInput[] {
  const data = JSON.parse(json) as { links?: unknown };
  if (!Array.isArray(data.links)) throw new Error('Not a Stash export');
  const out: NewLinkInput[] = [];
  for (const item of data.links) {
    if (!item || typeof item !== 'object') continue;
    const l = item as Partial<Link>;
    if (typeof l.url !== 'string' || !isOpenable(l.url)) continue;
    out.push({
      url: l.url,
      title: typeof l.title === 'string' ? l.title : undefined,
      description: typeof l.description === 'string' ? l.description : undefined,
      collection: cleanCollectionName(l.collection) || undefined,
      source: 'import',
      createdAt: typeof l.createdAt === 'number' ? l.createdAt : undefined,
    });
  }
  return out;
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Netscape bookmark file: importable by every browser. */
export function exportHtml(links: Link[]): string {
  const groups = new Map<string, Link[]>();
  for (const l of links) {
    if (!isOpenable(l.url)) continue;
    groups.set(l.collection, [...(groups.get(l.collection) ?? []), l]);
  }
  const lines = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    '<TITLE>Bookmarks</TITLE>',
    '<H1>Bookmarks</H1>',
    '<DL><p>',
    '  <DT><H3>Stash</H3>',
    '  <DL><p>',
  ];
  for (const [name, items] of groups) {
    lines.push(`    <DT><H3>${escapeHtml(name)}</H3>`, '    <DL><p>');
    for (const l of items) {
      const added = Math.floor(l.createdAt / 1000);
      lines.push(
        `      <DT><A HREF="${escapeHtml(l.url)}" ADD_DATE="${added}">${escapeHtml(displayTitle(l))}</A>`,
      );
    }
    lines.push('    </DL><p>');
  }
  lines.push('  </DL><p>', '</DL><p>');
  return lines.join('\n');
}

const escapeMd = (text: string) => text.replace(/([[\]()*_`\\])/g, '\\$1');

export function collectionToMarkdown(name: string, links: Link[], footer: boolean): string {
  const lines = [`## ${escapeMd(name)}`, ''];
  for (const l of links) {
    if (!isOpenable(l.url)) continue;
    const summary = l.summary || l.description;
    lines.push(
      `- [${escapeMd(displayTitle(l))}](${l.url})${summary ? ` — ${escapeMd(summary)}` : ''}`,
    );
  }
  if (footer) lines.push('', '<sub>via [Stash](https://github.com/kmcfar/stash)</sub>');
  return lines.join('\n');
}
