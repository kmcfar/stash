import type { Link } from './types';

const DAY = 86_400_000;

export interface CollectionSummary {
  name: string;
  count: number;
  top: Link[];
  lastAddedAt: number;
}

export interface LibraryView {
  pinned: Link[];
  recent: Link[];
  mostOpened: Link[];
  rediscover: Link[];
  collections: CollectionSummary[];
  total: number;
}

const byRecent = (a: Link, b: Link) => b.createdAt - a.createdAt;
const byUse = (a: Link, b: Link) =>
  b.openCount - a.openCount || (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0);

/**
 * Links saved a while ago and not opened since. Picks are stable for a day so
 * the row doesn't reshuffle on every new tab.
 */
export function pickRediscover(links: Link[], now: number, count = 3): Link[] {
  const stale = links.filter(
    (l) =>
      !l.pinned && now - l.createdAt > 60 * DAY && now - (l.lastOpenedAt ?? l.createdAt) > 60 * DAY,
  );
  const daySeed = Math.floor(now / DAY);
  const score = (id: string) => {
    let h = daySeed;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return h;
  };
  return stale.sort((a, b) => score(a.id) - score(b.id)).slice(0, count);
}

export function buildLibrary(all: Link[], now = Date.now()): LibraryView {
  const links = all.filter((l) => !l.archived);
  const groups = new Map<string, Link[]>();
  for (const link of links) {
    const list = groups.get(link.collection) ?? [];
    list.push(link);
    groups.set(link.collection, list);
  }
  const collections = [...groups.entries()]
    .map(([name, items]) => ({
      name,
      count: items.length,
      top: [...items].sort(byUse).slice(0, 3),
      lastAddedAt: Math.max(...items.map((l) => l.createdAt)),
    }))
    .sort((a, b) => b.lastAddedAt - a.lastAddedAt);

  return {
    pinned: links
      .filter((l) => l.pinned)
      .sort(byUse)
      .slice(0, 8),
    recent: [...links].sort(byRecent).slice(0, 6),
    mostOpened: links
      .filter((l) => l.openCount > 0)
      .sort(byUse)
      .slice(0, 6),
    rediscover: pickRediscover(links, now),
    collections,
    total: links.length,
  };
}
