import { liveQuery } from 'dexie';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Request, Response } from '../core/messages';
import { createIndex, type LinkIndex } from '../core/search';
import type { Link } from '../core/types';
import { db } from '../platform/db';

export function send<T extends Request>(message: T): Promise<Response<T['type']>> {
  return chrome.runtime.sendMessage(message);
}

/** Live view of every link. Re-renders when the background worker writes. */
export function useLinks(): Link[] | null {
  const [links, setLinks] = useState<Link[] | null>(null);
  useEffect(() => {
    const sub = liveQuery(() => db.links.toArray()).subscribe({
      next: setLinks,
      error: (e: unknown) => console.error('Stash: failed to read links', e),
    });
    return () => sub.unsubscribe();
  }, []);
  return links;
}

export function useIndex(links: Link[] | null): {
  index: LinkIndex | null;
  byId: Map<string, Link>;
} {
  return useMemo(() => {
    if (!links) return { index: null, byId: new Map<string, Link>() };
    return { index: createIndex(links), byId: new Map(links.map((l) => [l.id, l])) };
  }, [links]);
}
