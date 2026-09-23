import { describe, expect, it } from 'vitest';
import {
  badgeScope,
  defaultNeverRead,
  isNeverRead,
  isOpenable,
  matchesScope,
  normalizeUrl,
  sanitizeUrl,
  siteOf,
} from '../src/core/url';

describe('normalizeUrl', () => {
  it('treats cosmetic variants as the same link', () => {
    const a = normalizeUrl('https://www.Example.com/docs/?utm_source=x&b=2&a=1#intro');
    const b = normalizeUrl('https://example.com/docs?a=1&b=2');
    expect(a).toBe(b);
    expect(a).toBe('https://example.com/docs?a=1&b=2');
  });

  it('keeps the root path stable', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com');
  });

  it('leaves non-web URLs alone', () => {
    expect(normalizeUrl('javascript:alert(1)')).toBe('javascript:alert(1)');
  });
});

describe('sanitizeUrl', () => {
  it('strips credentials and secret-looking params', () => {
    const out = sanitizeUrl(
      'https://user:pw@api.example.com/x?token=abc&page=2&X-Amz-Signature=zz',
    );
    expect(out).toBe('https://api.example.com/x?page=2');
  });
});

describe('isOpenable', () => {
  it('only allows http and https', () => {
    expect(isOpenable('https://a.com')).toBe(true);
    expect(isOpenable('http://a.com')).toBe(true);
    expect(isOpenable('javascript:alert(1)')).toBe(false);
    expect(isOpenable('data:text/html,hi')).toBe(false);
    expect(isOpenable('file:///etc/passwd')).toBe(false);
    expect(isOpenable('not a url')).toBe(false);
  });
});

describe('siteOf / badgeScope', () => {
  it('groups GitHub by owner and scopes badges by repo', () => {
    expect(siteOf('https://github.com/kmcfar/stash/issues/1')).toBe('github.com/kmcfar');
    expect(badgeScope('https://github.com/kmcfar/stash/issues/1')).toBe('github.com/kmcfar/stash');
    expect(siteOf('https://www.docs.stripe.com/api')).toBe('docs.stripe.com');
  });

  it('matches links inside a scope but not lookalikes', () => {
    expect(matchesScope('https://github.com/kmcfar/stash/pulls', 'github.com/kmcfar/stash')).toBe(
      true,
    );
    expect(matchesScope('https://github.com/kmcfar/stash-two', 'github.com/kmcfar/stash')).toBe(
      false,
    );
  });
});

describe('isNeverRead', () => {
  const list = defaultNeverRead();
  it('blocks private hosts and listed patterns', () => {
    expect(isNeverRead('http://localhost:3000', list)).toBe(true);
    expect(isNeverRead('http://192.168.1.4/admin', list)).toBe(true);
    expect(isNeverRead('https://mail.google.com/mail/u/0', list)).toBe(true);
    expect(isNeverRead('https://wiki.corp/page', list)).toBe(true);
    expect(isNeverRead('https://docs.stripe.com', list)).toBe(false);
  });
});
