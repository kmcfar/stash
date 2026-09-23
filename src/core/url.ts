const TRACKING_PARAMS =
  /^(utm_\w+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|ref_src|_hsenc|_hsmi)$/i;
const SECRET_PARAMS =
  /^(token|access_token|id_token|refresh_token|key|api_key|apikey|sig|signature|code|session|sessionid|auth|password|pwd|secret|x-amz-\w+)$/i;

export function parseUrl(raw: string): URL | null {
  try {
    return new URL(raw.trim());
  } catch {
    return null;
  }
}

/** Only real web pages may be opened. Blocks javascript:, data:, file:, etc. */
export function isOpenable(raw: string): boolean {
  const url = parseUrl(raw);
  return url !== null && (url.protocol === 'http:' || url.protocol === 'https:');
}

/**
 * Remove credentials and secret-looking query params. Applied before anything
 * is stored or sent to a model.
 */
export function sanitizeUrl(raw: string): string {
  const url = parseUrl(raw);
  if (!url || !isOpenable(raw)) return raw.trim();
  url.username = '';
  url.password = '';
  for (const name of [...url.searchParams.keys()]) {
    if (SECRET_PARAMS.test(name)) url.searchParams.delete(name);
  }
  return url.toString();
}

/** Canonical form used for dedup: no tracking params, hash, www, or trailing slash. */
export function normalizeUrl(raw: string): string {
  const url = parseUrl(sanitizeUrl(raw));
  if (!url || !isOpenable(url.toString())) return raw.trim();
  url.hash = '';
  url.hostname = url.hostname.replace(/^www\./, '').toLowerCase();
  for (const name of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(name)) url.searchParams.delete(name);
  }
  url.searchParams.sort();
  let path = url.pathname.replace(/\/+$/, '');
  if (path === '') path = '/';
  const query = url.searchParams.toString();
  return `${url.protocol}//${url.host}${path === '/' ? '' : path}${query ? `?${query}` : ''}`;
}

/**
 * A human-friendly "site" for grouping. GitHub and GitLab repos are grouped by
 * owner, since one host holds many unrelated projects.
 */
export function siteOf(raw: string): string {
  const url = parseUrl(raw);
  if (!url) return 'other';
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'github.com' || host === 'gitlab.com') {
    const owner = url.pathname.split('/').filter(Boolean)[0];
    return owner ? `${host}/${owner}` : host;
  }
  if (host.endsWith('.github.io')) return host;
  return host || 'other';
}

/** Scope used by the toolbar badge: the repo on GitHub, otherwise the host. */
export function badgeScope(raw: string): string | null {
  const url = parseUrl(raw);
  if (!url || !isOpenable(raw)) return null;
  const host = url.hostname.replace(/^www\./, '');
  if (host === 'github.com') {
    const [owner, repo] = url.pathname.split('/').filter(Boolean);
    if (owner && repo) return `${host}/${owner}/${repo}`;
  }
  return host;
}

export function matchesScope(linkUrl: string, scope: string): boolean {
  const url = parseUrl(linkUrl);
  if (!url) return false;
  const hostAndPath = `${url.hostname.replace(/^www\./, '')}${url.pathname}`;
  return hostAndPath === scope || hostAndPath.startsWith(`${scope}/`);
}

const DEFAULT_NEVER_READ = [
  'localhost',
  '127.0.0.1',
  '*.local',
  '*.internal',
  '*.corp',
  'mail.google.com',
  'outlook.live.com',
  'outlook.office.com',
  '*.bank',
  '*bank*',
  'accounts.google.com',
  '1password.com',
  '*.1password.com',
];

export const defaultNeverRead = (): string[] => [...DEFAULT_NEVER_READ];

function isPrivateIp(host: string): boolean {
  return (
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^169\.254\./.test(host) ||
    host === '[::1]'
  );
}

/** True when page contents from this URL must never be read or sent to a model. */
export function isNeverRead(raw: string, patterns: string[]): boolean {
  const url = parseUrl(raw);
  if (!url || !isOpenable(raw)) return true;
  const host = url.hostname.toLowerCase();
  if (isPrivateIp(host)) return true;
  return patterns.some((pattern) => {
    const p = pattern.trim().toLowerCase();
    if (!p) return false;
    const re = new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
    return re.test(host);
  });
}
