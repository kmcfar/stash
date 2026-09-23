import { createLink, mergeResave, type NewLinkInput } from '../core/links';
import type { Link } from '../core/types';
import { normalizeUrl } from '../core/url';
import { cleanCollectionName, cleanText } from '../core/validate';
import { db as defaultDb, type StashDb } from './db';

/**
 * All writes live here and run only in the background worker. UI pages read
 * Dexie directly and mutate through messages.
 */

export interface SaveOutcome {
  link: Link;
  duplicate: boolean;
}

export async function saveLink(
  input: NewLinkInput,
  database: StashDb = defaultDb,
): Promise<SaveOutcome> {
  const incoming = createLink(input);
  return database.transaction('rw', database.links, async () => {
    const existing = await database.links
      .where('normalizedUrl')
      .equals(incoming.normalizedUrl)
      .first();
    if (existing) {
      const merged = mergeResave(existing, incoming);
      await database.links.put(merged);
      return { link: merged, duplicate: true };
    }
    await database.links.add(incoming);
    return { link: incoming, duplicate: false };
  });
}

/** Bulk insert for imports: skips URLs already saved. Returns only new links. */
export async function importLinks(
  inputs: NewLinkInput[],
  database: StashDb = defaultDb,
): Promise<Link[]> {
  return database.transaction('rw', database.links, async () => {
    const known = new Set(await allNormalized(database));
    const fresh: Link[] = [];
    for (const input of inputs) {
      const link = createLink(input);
      if (known.has(link.normalizedUrl)) continue;
      known.add(link.normalizedUrl);
      fresh.push(link);
    }
    await database.links.bulkAdd(fresh);
    return fresh;
  });
}

async function allNormalized(database: StashDb): Promise<string[]> {
  return (await database.links.orderBy('normalizedUrl').keys()) as string[];
}

export type LinkPatch = Partial<Pick<Link, 'pinned' | 'archived' | 'collection' | 'why'>>;

export async function updateLink(
  id: string,
  patch: LinkPatch,
  database: StashDb = defaultDb,
): Promise<Link | undefined> {
  const clean: Partial<Link> = {};
  if (typeof patch.pinned === 'boolean') clean.pinned = patch.pinned;
  if (typeof patch.archived === 'boolean') clean.archived = patch.archived;
  if (patch.collection !== undefined) {
    const name = cleanCollectionName(patch.collection);
    if (name) clean.collection = name;
  }
  if (patch.why !== undefined) clean.why = cleanText(patch.why, 160);
  await database.links.update(id, clean);
  return database.links.get(id);
}

export async function recordOpen(
  id: string,
  database: StashDb = defaultDb,
): Promise<Link | undefined> {
  const link = await database.links.get(id);
  if (!link) return undefined;
  const updated = { ...link, openCount: link.openCount + 1, lastOpenedAt: Date.now() };
  await database.links.put(updated);
  return updated;
}

export async function deleteLink(
  id: string,
  database: StashDb = defaultDb,
): Promise<Link | undefined> {
  const link = await database.links.get(id);
  await database.links.delete(id);
  return link;
}

export async function renameCollection(
  from: string,
  to: string,
  database: StashDb = defaultDb,
): Promise<number> {
  const name = cleanCollectionName(to);
  if (!name || name === from) return 0;
  return database.transaction('rw', database.links, database.collections, async () => {
    const count = await database.links
      .where('collection')
      .equals(from)
      .modify({ collection: name });
    const meta = await database.collections.get(from);
    await database.collections.delete(from);
    if (meta && !(await database.collections.get(name)))
      await database.collections.put({ ...meta, name });
    return count;
  });
}

export async function findByUrl(
  url: string,
  database: StashDb = defaultDb,
): Promise<Link | undefined> {
  return database.links.where('normalizedUrl').equals(normalizeUrl(url)).first();
}
