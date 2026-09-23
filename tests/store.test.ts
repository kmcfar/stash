import { afterEach, describe, expect, it } from 'vitest';
import { StashDb } from '../src/platform/db';
import { importLinks, recordOpen, renameCollection, saveLink } from '../src/platform/store';

let n = 0;
const fresh = () => new StashDb(`test-${n++}`);
const dbs: StashDb[] = [];
afterEach(async () => {
  for (const d of dbs.splice(0)) await d.delete();
});

describe('store', () => {
  it('dedups re-saves by normalized URL', async () => {
    const db = fresh();
    dbs.push(db);
    const first = await saveLink({ url: 'https://example.com/a?utm_source=x' }, db);
    const second = await saveLink({ url: 'https://www.example.com/a/', title: 'New title' }, db);
    expect(second.duplicate).toBe(true);
    expect(second.link.id).toBe(first.link.id);
    expect(await db.links.count()).toBe(1);
    expect((await db.links.get(first.link.id))?.title).toBe('New title');
  });

  it('imports only new links', async () => {
    const db = fresh();
    dbs.push(db);
    await saveLink({ url: 'https://a.com' }, db);
    const added = await importLinks(
      [{ url: 'https://a.com/' }, { url: 'https://b.com' }, { url: 'https://b.com' }],
      db,
    );
    expect(added).toHaveLength(1);
    expect(await db.links.count()).toBe(2);
  });

  it('renames collections and tracks opens', async () => {
    const db = fresh();
    dbs.push(db);
    const { link } = await saveLink({ url: 'https://a.com', collection: 'Old' }, db);
    await renameCollection('Old', 'new name', db);
    expect((await db.links.get(link.id))?.collection).toBe('New name');
    await recordOpen(link.id, db);
    expect((await db.links.get(link.id))?.openCount).toBe(1);
  });
});
