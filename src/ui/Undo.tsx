import { useEffect, useRef, useState } from 'preact/hooks';
import { displayTitle, type Link } from '../core/types';
import { send } from './data';

const UNDO_MS = 6000;

/**
 * Delete immediately, offer Undo instead of a confirm dialog. Undo puts the
 * exact same record back, so opens, pins and history survive.
 */
export function useDeleteWithUndo() {
  const [deleted, setDeleted] = useState<Link | null>(null);
  const timer = useRef(0);

  useEffect(() => () => clearTimeout(timer.current), []);

  const remove = (link: Link) => {
    send({ type: 'delete', id: link.id }).catch(() => {});
    setDeleted(link);
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setDeleted(null), UNDO_MS);
  };

  const undo = () => {
    if (!deleted) return;
    send({ type: 'restore', link: deleted }).catch(() => {});
    clearTimeout(timer.current);
    setDeleted(null);
  };

  const bar = deleted ? (
    <div class="snackbar" role="status">
      <span class="snackbar-text">Deleted “{displayTitle(deleted)}”</span>
      <button type="button" onClick={undo}>
        Undo
      </button>
    </div>
  ) : null;

  return { remove, bar };
}
