import { useMemo } from 'preact/hooks';
import { buildLibrary, type CollectionSummary } from '../../src/core/library';
import { displayTitle, type Link } from '../../src/core/types';
import { useLinks } from '../../src/ui/data';
import { Favicon } from '../../src/ui/LinkRow';
import { archiveLink, openLink, Search } from '../../src/ui/Search';

function Tile({ link }: { link: Link }) {
  return (
    <button
      type="button"
      class="tile"
      title={link.summary || link.url}
      onClick={(e) => openLink(link, e.metaKey || e.ctrlKey)}
    >
      <Favicon link={link} />
      <span class="tile-title">{displayTitle(link)}</span>
    </button>
  );
}

function Shelf({ title, links }: { title: string; links: Link[] }) {
  if (!links.length) return null;
  return (
    <section class="shelf" aria-label={title}>
      <h2>{title}</h2>
      <div class="tiles">
        {links.map((l) => (
          <Tile key={l.id} link={l} />
        ))}
      </div>
    </section>
  );
}

function Rediscover({ links }: { links: Link[] }) {
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
              {(l.summary || l.why) && <span class="rd-sub">{l.summary || l.why}</span>}
            </div>
            <button type="button" class="chip" onClick={() => openLink(l, false)}>
              Open
            </button>
            <button type="button" class="chip ghost" onClick={() => archiveLink(l)}>
              Archive
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CollectionCard({ c }: { c: CollectionSummary }) {
  return (
    <article class="card">
      <header>
        <h3>{c.name}</h3>
        <span class="count">{c.count}</span>
      </header>
      <ul>
        {c.top.map((l) => (
          <li key={l.id}>
            <button
              type="button"
              class="card-link"
              onClick={(e) => openLink(l, e.metaKey || e.ctrlKey)}
            >
              <Favicon link={l} />
              <span>{displayTitle(l)}</span>
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}

function Welcome() {
  return (
    <section class="welcome">
      <h1>Your links, finally findable.</h1>
      <ol>
        <li>
          Press <kbd>Alt</kbd> <kbd>Shift</kbd> <kbd>S</kbd> on any page to save it. No folders to
          pick.
        </li>
        <li>Stash files it and writes down what it is and why you saved it.</li>
        <li>Open a new tab and type. That's it.</li>
      </ol>
      <p class="hint">
        Shortcut taken? Change it at <code>chrome://extensions/shortcuts</code>.
      </p>
    </section>
  );
}

export function App() {
  const links = useLinks();
  const library = useMemo(() => (links ? buildLibrary(links) : null), [links]);
  const initialQuery = new URLSearchParams(location.search).get('q') ?? '';

  return (
    <main class="page">
      <Search links={links} initialQuery={initialQuery}>
        {library && library.total === 0 && <Welcome />}
        {library && library.total > 0 && (
          <div class="library">
            <Shelf title="Pinned" links={library.pinned} />
            <Shelf title="Recent" links={library.recent} />
            <Shelf title="Most opened" links={library.mostOpened} />
            <Rediscover links={library.rediscover} />
            <section class="shelf" aria-label="Collections">
              <h2>
                Collections <span class="muted">· {library.total} links</span>
              </h2>
              <div class="cards">
                {library.collections.map((c) => (
                  <CollectionCard key={c.name} c={c} />
                ))}
              </div>
            </section>
          </div>
        )}
      </Search>
    </main>
  );
}
