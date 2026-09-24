import { describe, expect, it } from 'vitest';
import { pickDescription, trimPageText } from '../src/core/text';

describe('pickDescription', () => {
  it('prefers the meta description', () => {
    expect(
      pickDescription('ChatGPT', [
        'ChatGPT helps you get answers, find inspiration and be more productive.',
        'excerpt',
      ]),
    ).toBe('ChatGPT helps you get answers, find inspiration and be more productive.');
  });

  it('skips candidates that are too short or just repeat the title', () => {
    expect(
      pickDescription('Webhooks | Stripe Docs', [
        'Webhooks | Stripe Docs',
        'Docs',
        'Listen for events on your Stripe account so your integration can automatically trigger reactions.',
      ]),
    ).toMatch(/^Listen for events/);
  });

  it('shortens long page text at a sentence or word boundary', () => {
    const text =
      'Stash replaces the bookmark bar. It saves any link with one key and finds it in three seconds from your new tab, with summaries written for you so you remember why it mattered.';
    const out = pickDescription('Stash', [undefined, text], 120);
    expect(out.length).toBeLessThanOrEqual(121);
    expect(out === 'Stash replaces the bookmark bar.' || out.endsWith('…')).toBe(true);
  });

  it('returns empty when nothing useful exists', () => {
    expect(pickDescription('X', [undefined, '', 'short'])).toBe('');
  });
});

describe('trimPageText', () => {
  it('stays under the cap', () => {
    expect(trimPageText('word '.repeat(2000), 4000).length).toBeLessThanOrEqual(4000);
  });
});
