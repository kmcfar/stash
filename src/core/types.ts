export const KINDS = [
  'doc',
  'repo',
  'dashboard',
  'article',
  'tool',
  'reference',
  'video',
  'other',
] as const;
export type Kind = (typeof KINDS)[number];

export type AiStatus = 'none' | 'pending' | 'done' | 'error';

/** Where the user was when they saved a link. Used to infer "why" automatically. */
export interface SaveContext {
  referrer?: string;
  tabGroup?: string;
  openerTitle?: string;
  windowTabs?: { title: string; site: string }[];
}

export interface Link {
  id: string;
  /** Original URL, used for opening. */
  url: string;
  /** Canonical form, used for dedup. */
  normalizedUrl: string;
  title: string;
  description: string;
  favicon?: string;
  site: string;
  /** Trimmed main text. Kept only until enrichment finishes. */
  pageText?: string;

  aiTitle?: string;
  summary?: string;
  kind?: Kind;
  keywords: string[];
  why?: string;
  context: SaveContext;

  tags: string[];
  collection: string;

  pinned: boolean;
  archived: boolean;
  createdAt: number;
  lastOpenedAt?: number;
  openCount: number;
  source: 'capture' | 'import';
  aiStatus: AiStatus;
  aiAttempts: number;
  aiNextAttemptAt?: number;
  bookmarkId?: string;
}

export interface Collection {
  name: string;
  description?: string;
  linkCountAtDescribe: number;
}

/** What any AI provider must return for a single link. Validated before use. */
export interface Enrichment {
  title: string;
  summary: string;
  kind: Kind;
  collection: string;
  tags: string[];
  keywords: string[];
  why: string;
}

export function displayTitle(link: Pick<Link, 'aiTitle' | 'title' | 'url'>): string {
  return link.aiTitle || link.title || link.url;
}
