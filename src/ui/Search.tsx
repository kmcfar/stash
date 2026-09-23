import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { searchLinks } from '../core/search';
import type { Link } from '../core/types';
import { send, useIndex } from './data';
import { LinkRow } from './LinkRow';

interface Props {
  links: Link[] | null;
  initialQuery?: string;
  placeholder?: string;
  /** Rendered when the query is empty. */
  children?: ComponentChildren;
  /** Newtab navigates in place; the popup always opens a new tab. */
  openInNewTab?: boolean;
}

export function openLink(link: Link, background: boolean): void {
  send({ type: 'open', id: link.id, background }).catch(() => {});
}

export function pinLink(link: Link): void {
  send({ type: 'update', id: link.id, patch: { pinned: !link.pinned } }).catch(() => {});
}

export function archiveLink(link: Link): void {
  send({ type: 'update', id: link.id, patch: { archived: true } }).catch(() => {});
}

/**
 * Search box and results, following the ARIA combobox pattern: focus stays in
 * the input and arrow keys move the active option.
 */
export function Search({ links, initialQuery = '', placeholder, children, openInNewTab }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const { index, byId } = useIndex(links);

  const results = useMemo(
    () => (index && query.trim() ? searchLinks(index, query, byId) : []),
    [index, byId, query],
  );

  useEffect(() => setActive(0), [query]);
  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => {
    document.getElementById(`opt-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const open = (link: Link, background: boolean) => {
    if (openInNewTab && !background) {
      send({ type: 'open', id: link.id, background: false }).then(() => window.close());
      return;
    }
    openLink(link, background);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      const link = results[active];
      if (link) {
        e.preventDefault();
        open(link, e.metaKey || e.ctrlKey);
      }
    } else if (e.key === 'Escape' && query) {
      e.preventDefault();
      setQuery('');
    }
  };

  const searching = query.trim().length > 0;
  return (
    <div class="search">
      <div class="search-box">
        <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" stroke-width="2" />
          <path d="m20 20-4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          role="combobox"
          aria-expanded={searching}
          aria-controls="results"
          aria-activedescendant={searching && results.length ? `opt-${active}` : undefined}
          aria-label="Search your Stash"
          placeholder={placeholder ?? 'Search your Stash'}
          value={query}
          onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
          onKeyDown={onKeyDown}
          autocomplete="off"
          spellcheck={false}
        />
      </div>
      {searching ? (
        results.length ? (
          <div id="results" role="listbox" class="results" aria-label="Results">
            {results.map((link, i) => (
              <LinkRow
                key={link.id}
                id={`opt-${i}`}
                link={link}
                active={i === active}
                onOpen={open}
                onHover={() => setActive(i)}
                onTogglePin={pinLink}
                onArchive={archiveLink}
              />
            ))}
          </div>
        ) : (
          <p class="empty">Nothing matches “{query.trim()}”.</p>
        )
      ) : (
        children
      )}
    </div>
  );
}
