import { describe, expect, it } from 'vitest';
import { heuristicWhy } from '../src/core/links';
import {
  bookmarksToInputs,
  collectionToMarkdown,
  exportHtml,
  exportJson,
  importJson,
} from '../src/core/transfer';
import { link } from './fixtures';

describe('bookmarksToInputs', () => {
  it('uses the nearest folder as the collection and skips unsafe URLs', () => {
    const inputs = bookmarksToInputs(
      [
        {
          id: '0',
          title: '',
          children: [
            {
              id: '1',
              title: 'Bookmarks bar',
              children: [
                { id: '2', title: 'Top', url: 'https://top.com' },
                { id: '3', title: 'bm', url: 'javascript:alert(1)' },
                {
                  id: '4',
                  title: 'work',
                  children: [{ id: '5', title: 'Jira', url: 'https://jira.com' }],
                },
                {
                  id: '6',
                  title: 'Stash',
                  children: [{ id: '7', title: 'x', url: 'https://x.com' }],
                },
              ],
            },
          ],
        },
      ],
      '6',
    );
    expect(inputs.map((i) => [i.url, i.collection])).toEqual([
      ['https://top.com', undefined],
      ['https://jira.com', 'Work'],
    ]);
  });
});

describe('export', () => {
  const evil = link({ url: 'https://a.com/?q="><script>', title: '<b>hi</b>', collection: 'A&B' });

  it('round-trips JSON', () => {
    const inputs = importJson(exportJson([evil]));
    expect(inputs[0]?.url).toBe(evil.url);
  });

  it('escapes HTML export', () => {
    const html = exportHtml([evil]);
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>');
  });

  it('writes markdown with an optional footer', () => {
    expect(collectionToMarkdown('Docs', [evil], true)).toContain('via [Stash]');
    expect(collectionToMarkdown('Docs', [evil], false)).not.toContain('via [Stash]');
  });
});

describe('heuristicWhy', () => {
  it('describes where a link came from without AI', () => {
    expect(
      heuristicWhy({ referrer: 'https://news.ycombinator.com/item?id=1', tabGroup: 'Q3 planning' }),
    ).toBe('Saved from news.ycombinator.com · in group “Q3 planning”');
  });
});
