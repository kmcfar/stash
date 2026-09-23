import { describe, expect, it } from 'vitest';
import {
  askCandidates,
  createIndex,
  loadIndex,
  searchLinks,
  serializeIndex,
} from '../src/core/search';
import { link } from './fixtures';

const links = [
  link(
    { url: 'https://grafana.example.com/d/abc', title: 'Grafana' },
    { aiTitle: 'Metrics dashboard', keywords: ['kpis', 'churn'], collection: 'Dashboards' },
  ),
  link({ url: 'https://docs.stripe.com/webhooks', title: 'Webhooks | Stripe Docs' }),
  link({ url: 'https://github.com/kmcfar/stash', title: 'kmcfar/stash' }, { archived: true }),
];
const byId = new Map(links.map((l) => [l.id, l]));

describe('searchLinks', () => {
  const index = createIndex(links);

  it('finds by hidden AI keywords', () => {
    expect(searchLinks(index, 'kpis', byId)[0]?.aiTitle).toBe('Metrics dashboard');
  });

  it('supports prefix and typo tolerance', () => {
    expect(searchLinks(index, 'webho', byId)).toHaveLength(1);
    expect(searchLinks(index, 'strpe', byId)).toHaveLength(1);
  });

  it('never returns archived links', () => {
    expect(searchLinks(index, 'stash', byId)).toHaveLength(0);
  });

  it('survives a serialize round-trip', () => {
    const restored = loadIndex(serializeIndex(index));
    expect(searchLinks(restored, 'churn', byId)).toHaveLength(1);
  });
});

describe('askCandidates', () => {
  it('fills up to the limit with recent links when recall is low', () => {
    const index = createIndex(links);
    expect(askCandidates(index, 'something unrelated', byId, 2)).toHaveLength(2);
  });
});
