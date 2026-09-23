import { render } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { displayTitle } from '../../src/core/types';
import { badgeScope, matchesScope } from '../../src/core/url';
import { send, useLinks } from '../../src/ui/data';
import { Favicon } from '../../src/ui/LinkRow';
import { Search } from '../../src/ui/Search';

function Popup() {
  const links = useLinks();
  const [scope, setScope] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }).then(([tab]) => {
      setScope(tab?.url ? badgeScope(tab.url) : null);
    });
  }, []);

  const fromHere = useMemo(
    () => (links && scope ? links.filter((l) => !l.archived && matchesScope(l.url, scope)) : []),
    [links, scope],
  );

  const save = async () => {
    const res = await send({ type: 'saveTab' });
    setStatus(res.ok ? `Saved → ${res.link.collection}` : res.error);
  };
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
      <div class="popup-actions">
        <button type="button" class="primary" onClick={save}>
          Save this page
        </button>
        <button type="button" class="chip" onClick={() => saveWindow(false)}>
          Save all tabs
        </button>
        <button
          type="button"
          class="chip ghost"
          onClick={() => saveWindow(true)}
          title="Save every tab, then close them"
        >
          Save &amp; close
        </button>
      </div>
      {status && (
        <p class="status" role="status">
          {status}
        </p>
      )}
      <Search links={links} openInNewTab>
        {fromHere.length > 0 && (
          <section class="shelf">
            <h2>Saved from {scope}</h2>
            <ul class="mini">
              {fromHere.slice(0, 8).map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    class="card-link"
                    onClick={() => send({ type: 'open', id: l.id }).then(() => window.close())}
                  >
                    <Favicon link={l} />
                    <span>{displayTitle(l)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </Search>
    </main>
  );
}

render(<Popup />, document.getElementById('app') as HTMLElement);
