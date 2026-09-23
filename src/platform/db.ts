import Dexie, { type EntityTable } from 'dexie';
import type { Collection, Link } from '../core/types';

export interface StatEvent {
  id?: number;
  type: 'save' | 'search' | 'open' | 'find' | 'zero' | 'newtab' | 'ask';
  at: number;
  ms?: number;
}

export class StashDb extends Dexie {
  links!: EntityTable<Link, 'id'>;
  collections!: EntityTable<Collection, 'name'>;
  stats!: EntityTable<StatEvent, 'id'>;

  constructor(name = 'stash') {
    super(name);
    this.version(1).stores({
      links: 'id, &normalizedUrl, collection, createdAt, aiStatus, bookmarkId',
      collections: 'name',
      stats: '++id, type, at',
    });
  }
}

export const db = new StashDb();

export async function collectionNames(database: StashDb = db): Promise<string[]> {
  const names = (await database.links.orderBy('collection').uniqueKeys()) as string[];
  return names.filter(Boolean);
}
