import { useEffect, useMemo, useState } from 'preact/hooks';
import { buildLibrary, type CollectionSummary } from '../../src/core/library';
import { displayTitle, type Link } from '../../src/core/types';
import { useLinks } from '../../src/ui/data';
import { Favicon } from '../../src/ui/LinkRow';
import { openLink, Search } from '../../src/ui/Search';
import { useDeleteWithUndo } from '../../src/ui/Undo';

type Remove = (link: Link) => void;

const describe = (link: Link) => link.summary || link.description || link.why || '';

function DeleteButton({ link, onDelete }: { link: Link; onDelete: Remove }) {
  return (
    <button
      type="button"
      class="delete-btn"
      aria-label={`Delete ${displayTitle(link)}`}
      title="Delete"
      onClick={(e) => {
        e.stopPropagation();
        onDelete(link);
      }}
    >
      ✕
    </button>
  );
}

function Tile({ link, onDelete }: { link: Link; onDelete: Remove }) {
  const description = describe(link);
  return (
    <div class="tile-wrap">
      <button
        type="button"
        class="tile"
        title={link.url}
        onClick={(e) => openLink(link, e.metaKey || e.ctrlKey)}
      >
        <Favicon link={link} />
        <span class="tile-text">
          <span class="tile-title">{displayTitle(link)}</span>
          <span class="tile-sub">{description || link.site}</span>
        </span>
      </button>
      <DeleteButton link={link} onDelete={onDelete} />
    </div>
  );
}

function Shelf({ title, links, onDelete }: { title: string; links: Link[]; onDelete: Remove }) {
  if (!links.length) return null;
  return (
    <section class="shelf" aria-label={title}>
      <h2>{title}</h2>
      <div class="tiles">
        {links.map((l) => (
          <Tile key={l.id} link={l} onDelete={onDelete} />
        ))}
      </div>
    </section>
  );
}

function Rediscover({ links, onDelete }: { links: Link[]; onDelete: Remove }) {
  if (!links.length) return null;
  return (
    <section class="shelf" aria-label="Rediscover">
      <h2>Rediscover</h2>
      <ul class="rediscover">
        {links.map((l) => (
          <li key={l.id}>
            <Favicon link={l} />
            <div class="rd-body">
              <span class="tile-title">{displayTitle(l)}</span>
              <span class="rd-sub">{describe(l) || l.site}</span>
            </div>
            <button type="button" class="chip" onClick={() => openLink(l, false)}>
              Open
            </button>
            <button type="button" class="chip ghost" onClick={() => onDelete(l)}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CollectionCard({ c, onDelete }: { c: CollectionSummary; onDelete: Remove }) {
  return (
    <article class="card">
      <header>
        <h3>{c.name}</h3>
        <span class="count">{c.count}</span>
      </header>
      <ul>
        {c.top.map((l) => (
          <li key={l.id} class="tile-wrap">
            <button
              type="button"
              class="card-link"
              title={l.url}
              onClick={(e) => openLink(l, e.metaKey || e.ctrlKey)}
            >
              <Favicon link={l} />
              <span class="tile-text">
                <span class="tile-title">{displayTitle(l)}</span>
                {describe(l) && <span class="tile-sub">{describe(l)}</span>}
              </span>
            </button>
            <DeleteButton link={l} onDelete={onDelete} />
          </li>
        ))}
      </ul>
    </article>
  );
}

const PIN_HINT_KEY = 'stash.pinHintDismissed';

function readDismissed(): boolean {
  try {
    return localStorage.getItem(PIN_HINT_KEY) === '1';
  } catch {
    return false;
  }
}

/** Nudge until the toolbar icon is pinned: it's the one-click way to save. */
function PinHint() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    if (readDismissed()) return;
    chrome.action
      .getUserSettings()
      .then((s) => setShow(!s.isOnToolbar))
      .catch(() => {});
  }, []);
  if (!show) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(PIN_HINT_KEY, '1');
    } catch {
      // Private window or blocked storage: just hide for now.
    }
    setShow(false);
  };
  return (
    <aside class="pin-hint">
      <span>
        <strong>Pin Stash next to your address bar</strong> so saving is one click: open the{' '}
        <span role="img" aria-label="Extensions">
          🧩
        </span>{' '}
        menu at the top right, then click the pin next to Stash.
      </span>
      <button type="button" class="chip ghost" onClick={dismiss}>
        Got it
      </button>
    </aside>
  );
}

function Welcome() {
  return (
    <section class="welcome">
      <h1>Your links, finally findable.</h1>
      <ol>
        <li>
          Click the <strong>Stash</strong> icon next to your address bar to save any page. No
          folders to pick.
        </li>
        <li>Stash files it and notes what it is and why you saved it.</li>
        <li>Open a new tab and type. That's it.</li>
      </ol>
      <p class="hint">
        Keyboard fan? <kbd>Alt</kbd> <kbd>Shift</kbd> <kbd>S</kbd> saves too.
      </p>
    </section>
  );
}

export function App() {
  const links = useLinks();
  const library = useMemo(() => (links ? buildLibrary(links) : null), [links]);
  const initialQuery = new URLSearchParams(location.search).get('q') ?? '';
  const { remove, bar } = useDeleteWithUndo();

  return (
    <main class="page">
      <PinHint />
      <Search links={links} initialQuery={initialQuery} onDelete={remove}>
        {library && library.total === 0 && <Welcome />}
        {library && library.total > 0 && (
          <div class="library">
            <Shelf title="Pinned" links={library.pinned} onDelete={remove} />
            <Shelf title="Recent" links={library.recent} onDelete={remove} />
            <Shelf title="Most opened" links={library.mostOpened} onDelete={remove} />
            <Rediscover links={library.rediscover} onDelete={remove} />
            <section class="shelf" aria-label="Collections">
              <h2>
                Collections{' '}
                <span class="muted">
                  · {library.total} {library.total === 1 ? 'link' : 'links'}
                </span>
              </h2>
              <div class="cards">
                {library.collections.map((c) => (
                  <CollectionCard key={c.name} c={c} onDelete={remove} />
                ))}
              </div>
            </section>
          </div>
        )}
      </Search>
      {bar}
    </main>
  );
}
