import { relativeTime } from '../core/text';
import { displayTitle, type Link } from '../core/types';
import { isOpenable } from '../core/url';

interface Props {
  link: Link;
  id: string;
  active: boolean;
  onOpen: (link: Link, background: boolean) => void;
  onHover: () => void;
  onTogglePin: (link: Link) => void;
  onDelete: (link: Link) => void;
}

/** Chrome's local favicon cache: no network request to the saved site. */
function faviconUrl(pageUrl: string): string {
  const url = new URL(chrome.runtime.getURL('/_favicon/'));
  url.searchParams.set('pageUrl', pageUrl);
  url.searchParams.set('size', '32');
  return url.toString();
}

export function Favicon({ link }: { link: Link }) {
  if (!isOpenable(link.url)) {
    return (
      <span class="fav fav-letter" aria-hidden="true">
        {(link.site[0] ?? '?').toUpperCase()}
      </span>
    );
  }
  return (
    <img class="fav" src={faviconUrl(link.url)} alt="" width={20} height={20} loading="lazy" />
  );
}

export function LinkRow({ link, id, active, onOpen, onHover, onTogglePin, onDelete }: Props) {
  const openable = isOpenable(link.url);
  const detail = link.summary || link.description;
  const opened = link.openCount ? `Opened ${link.openCount}×` : 'Never opened';
  return (
    // Options in an ARIA combobox are not focusable: the input keeps focus and
    // handles the keyboard via aria-activedescendant.
    // biome-ignore lint/a11y/useFocusableInteractive: see above
    // biome-ignore lint/a11y/useKeyWithClickEvents: see above
    <div
      id={id}
      role="option"
      aria-selected={active}
      class={`row${active ? ' active' : ''}`}
      onMouseMove={onHover}
      onClick={(e) => openable && onOpen(link, e.metaKey || e.ctrlKey)}
    >
      <Favicon link={link} />
      <div class="row-body">
        <div class="row-title">
          <span class="title-text">{displayTitle(link)}</span>
          {link.kind && <span class="kind">{link.kind}</span>}
          {!openable && <span class="kind warn">not a web link</span>}
        </div>
        {detail && <div class="row-summary">{detail}</div>}
        <div class="row-meta">
          <span>{link.site}</span>
          <span>{link.collection}</span>
          <span>Saved {relativeTime(link.createdAt)}</span>
          <span>{opened}</span>
        </div>
        {link.why && <div class="row-why">{link.why}</div>}
      </div>
      <div class="row-actions">
        <button
          type="button"
          class="icon-btn"
          aria-label={link.pinned ? 'Unpin' : 'Pin'}
          title={link.pinned ? 'Unpin' : 'Pin'}
          aria-pressed={link.pinned}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin(link);
          }}
        >
          {link.pinned ? '★' : '☆'}
        </button>
        <button
          type="button"
          class="icon-btn"
          aria-label="Delete"
          title="Delete (⌘⌫)"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(link);
          }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}
