import type { Link } from './types';

/** Every mutation goes through the background worker, which is the only DB writer. */
export type Request =
  | { type: 'saveTab'; toast?: boolean }
  | { type: 'saveWindow'; close: boolean }
  | { type: 'open'; id: string; background?: boolean }
  | {
      type: 'update';
      id: string;
      patch: Partial<Pick<Link, 'pinned' | 'archived' | 'collection' | 'why'>>;
    }
  | { type: 'delete'; id: string }
  | { type: 'undoSave'; id: string }
  | { type: 'restore'; link: Link }
  | { type: 'renameCollection'; from: string; to: string }
  | { type: 'importBookmarks' }
  | { type: 'importJson'; json: string }
  | { type: 'ask'; question: string }
  | { type: 'enrichAll' }
  | { type: 'aiStatus' };

export type Response<T extends Request['type']> = T extends 'saveTab'
  ? { ok: true; link: Link; duplicate: boolean } | { ok: false; error: string }
  : T extends 'saveWindow'
    ? { ok: true; saved: number }
    : T extends 'importBookmarks' | 'importJson'
      ? { ok: true; imported: number; collections: number } | { ok: false; error: string }
      : T extends 'ask'
        ? { ok: true; ids: string[] } | { ok: false; error: string }
        : T extends 'aiStatus'
          ? { provider: 'claude' | 'chrome' | 'none'; pending: number; spentUsd: number }
          : { ok: boolean; error?: string };
