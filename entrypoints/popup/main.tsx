import { render } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { displayTitle, type Link } from '../../src/core/types';
import { badgeScope, matchesScope } from '../../src/core/url';
import { send, useLinks } from '../../src/ui/data';
import { Favicon } from '../../src/ui/LinkRow';
import { Search } from '../../src/ui/Search';
import { useDeleteWithUndo } from '../../src/ui/Undo';

type SaveState =
  | { kind: 'saving' }
  | { kind: 'saved'; id: string; duplicate: boolean }
  | { kind: 'unsavable'; message: string };

/**
 * Clicking the toolbar icon saves the page immediately, like Chrome's star.
 * The popup then confirms, and offers Move and Remove, plus search.
 */
function SavedCard({
  state,
  link,
  collections,
}: {
  state: SaveState;
  link: Link | undefined;
  collections: string[];
}) {
  const [removed, setRemoved] = useState(false);
  if (state.kind === 'saving') return <p class="status">Saving…</p>;
  if (state.kind === 'unsavable') return <p class="status">{state.message}</p>;
  if (removed) return <p class="status">Removed from your Stash.</p>;
  if (!link) return null;

  const description = link.summary || link.description;
  return (
    <section class="saved" aria-live="polite">
      <div class="saved-head">
        <span class="saved-check" aria-hidden="true">
          ✓
        </span>
        <span>{state.duplicate ? 'Already in your Stash' : 'Saved to your Stash'}</span>
      </div>
      <div class="saved-body">
        <Favicon link={link} />
        <div class="tile-text">
          <span class="tile-title">{displayTitle(link)}</span>
          {description && <span class="saved-desc">{description}</span>}
          {link.why && <span class="row-why">{link.why}</span>}
        </div>
      </div>
      <div class="saved-actions">
        <label class="move">
          <span>Collection</span>
          <select
            value={link.collection}
            onChange={(e) =>
              send({
                type: 'update',
                id: link.id,
                patch: { collection: (e.target as HTMLSelectElement).value },
              })
            }
          >
            {[...new Set([link.collection, ...collections])].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          class="chip ghost"
          onClick={() => {
            send({ type: 'delete', id: link.id });
            setRemoved(true);
          }}
        >
          Remove
        </button>
      </div>
    </section>
  );
}

function Popup() {
  const links = useLinks();
  const [scope, setScope] = useState<string | null>(null);
  const [state, setState] = useState<SaveState>({ kind: 'saving' });
  const [status, setStatus] = useState('');
  const { remove, bar } = useDeleteWithUndo();

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      setScope(tab?.url ? badgeScope(tab.url) : null);
    });
    send({ type: 'saveTab', toast: false }).then(
      (res) =>
        setState(
          res.ok
            ? { kind: 'saved', id: res.link.id, duplicate: res.duplicate }
            : { kind: 'unsavable', message: 'This page can’t be saved. Search your Stash below.' },
        ),
      () => setState({ kind: 'unsavable', message: 'Couldn’t save this page.' }),
    );
  }, []);

  const saved = state.kind === 'saved' ? links?.find((l) => l.id === state.id) : undefined;
  const collections = useMemo(
    () => [...new Set((links ?? []).map((l) => l.collection))].sort(),
    [links],
  );
  const fromHere = useMemo(
    () =>
      links && scope
        ? links.filter((l) => !l.archived && l.id !== saved?.id && matchesScope(l.url, scope))
        : [],
    [links, scope, saved?.id],
  );

  const saveWindow = async (close: boolean) => {
    // Reading other tabs' URLs needs the optional `tabs` permission; ask on first use.
    if (!(await chrome.permissions.request({ permissions: ['tabs'] }))) {
      setStatus('Stash needs tab access to save all tabs.');
      return;
    }
    const res = await send({ type: 'saveWindow', close });
    setStatus(`Saved ${res.saved} tabs`);
  };

  return (
    <main class="popup-main">
      <SavedCard state={state} link={saved} collections={collections} />
      <Search links={links} openInNewTab onDelete={remove} placeholder="Search your Stash">
        {fromHere.length > 0 && (
          <section class="shelf">
            <h2>Also saved from {scope}</h2>
            <ul class="mini">
              {fromHere.slice(0, 6).map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    class="card-link"
                    onClick={() => send({ type: 'open', id: l.id }).then(() => window.close())}
                  >
                    <Favicon link={l} />
                    <span class="tile-title">{displayTitle(l)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </Search>
      <footer class="popup-footer">
        <button type="button" class="link-btn" onClick={() => saveWindow(false)}>
          Save all tabs in this window
        </button>
        <button type="button" class="link-btn" onClick={() => saveWindow(true)}>
          Save all &amp; close
        </button>
        {status && (
          <span class="status" role="status">
            {status}
          </span>
        )}
      </footer>
      {bar}
    </main>
  );
}

render(<Popup />, document.getElementById('app') as HTMLElement);
