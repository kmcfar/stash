import { describe, expect, it } from 'vitest';
import { buildLibrary } from '../src/core/library';
import { link } from './fixtures';

const DAY = 86_400_000;
const now = Date.UTC(2026, 8, 1);

describe('buildLibrary', () => {
  const links = [
    link({ url: 'https://a.com/1', collection: 'Docs' }, { pinned: true, createdAt: now - DAY }),
    link(
      { url: 'https://a.com/2', collection: 'Docs' },
      { openCount: 5, createdAt: now - 2 * DAY },
    ),
    link({ url: 'https://b.com/old', collection: 'Reading' }, { createdAt: now - 90 * DAY }),
    link({ url: 'https://b.com/gone', collection: 'Reading' }, { archived: true }),
  ];
  const lib = buildLibrary(links, now);

  it('builds each section', () => {
    expect(lib.total).toBe(3);
    expect(lib.pinned).toHaveLength(1);
    expect(lib.mostOpened[0]?.url).toBe('https://a.com/2');
    expect(lib.collections.map((c) => [c.name, c.count])).toEqual([
      ['Docs', 2],
      ['Reading', 1],
    ]);
  });

  it('rediscovers only stale, unopened links', () => {
    expect(lib.rediscover.map((l) => l.url)).toEqual(['https://b.com/old']);
  });
});
