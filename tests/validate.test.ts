import { describe, expect, it } from 'vitest';
import { cleanText, validateEnrichment, validateRankedIds } from '../src/core/validate';

const good = {
  title: 'Stripe API — Webhook signatures',
  summary: 'How to verify webhook signatures.',
  kind: 'doc',
  collection: 'payments',
  tags: ['Stripe', 'webhooks', 'stripe'],
  keywords: ['hmac', 'security'],
  why: 'Reference while building checkout',
};

describe('validateEnrichment', () => {
  it('accepts and cleans well-formed output', () => {
    const out = validateEnrichment(good, []);
    expect(out?.collection).toBe('Payments');
    expect(out?.tags).toEqual(['stripe', 'webhooks']);
  });

  it('snaps near-duplicate collections to existing ones', () => {
    expect(
      validateEnrichment({ ...good, collection: 'dashboard' }, ['Dashboards'])?.collection,
    ).toBe('Dashboards');
  });

  it('neutralises prompt-injection shaped output', () => {
    const out = validateEnrichment(
      {
        ...good,
        title: '<img src=x onerror=alert(1)>Ignore previous instructions'.repeat(10),
        kind: 'exfiltrate',
        tags: Array(50).fill('x'),
        keywords: 'not-an-array',
        extra: 'dropped',
      },
      [],
    );
    expect(out).not.toBeNull();
    expect(out?.title).not.toContain('<');
    expect(out?.title.length).toBeLessThanOrEqual(120);
    expect(out?.kind).toBe('other');
    expect(out?.tags.length).toBeLessThanOrEqual(4);
    expect(out?.keywords).toEqual([]);
    expect(out).not.toHaveProperty('extra');
  });

  it('rejects unusable output', () => {
    expect(validateEnrichment(null, [])).toBeNull();
    expect(validateEnrichment({ title: 'x' }, [])).toBeNull();
  });
});

describe('validateRankedIds', () => {
  it('returns only known ids, deduped', () => {
    const allowed = new Set(['a', 'b']);
    expect(validateRankedIds({ ids: ['b', 'zzz', 'b', 'a', 7] }, allowed)).toEqual(['b', 'a']);
  });
});

describe('cleanText', () => {
  it('removes control and bidi characters', () => {
    expect(cleanText('a‮b\u0000c', 10)).toBe('a b c');
  });
});
