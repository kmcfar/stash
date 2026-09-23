/**
 * Serialized and injected into the page with chrome.scripting, so it must be
 * self-contained: no imports, no closures. Renders inside a closed shadow root
 * so page CSS can't touch it and the page can't read it.
 */
export function showToast(message: string, linkId: string | null, collections: string[]): void {
  const HOST_ID = 'stash-toast-host';
  document.getElementById(HOST_ID)?.remove();

  const host = document.createElement('div');
  host.id = HOST_ID;
  host.style.cssText =
    'all: initial; position: fixed; z-index: 2147483647; bottom: 24px; right: 24px;';
  const root = host.attachShadow({ mode: 'closed' });
  const dark = matchMedia('(prefers-color-scheme: dark)').matches;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const style = document.createElement('style');
  style.textContent = `
    .t { font: 14px/1.4 system-ui, -apple-system, sans-serif; display: flex; gap: 12px; align-items: center;
      padding: 12px 14px 12px 16px; border-radius: 12px; min-width: 260px; max-width: 420px;
      background: ${dark ? '#26262b' : '#ffffff'}; color: ${dark ? '#f2f2f3' : '#1c1c1f'};
      box-shadow: 0 8px 28px rgba(0,0,0,.18), 0 0 0 1px ${dark ? '#3a3a41' : '#e6e6ea'};
      ${reduce ? '' : 'animation: in .18s ease-out;'} }
    @keyframes in { from { transform: translateY(8px); opacity: 0 } }
    .m { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    b { font-weight: 600; }
    button, select { font: inherit; font-size: 13px; border: 0; border-radius: 8px; padding: 6px 10px; cursor: pointer;
      background: ${dark ? '#34343b' : '#f1f1f4'}; color: inherit; }
    button:focus-visible, select:focus-visible { outline: 2px solid #ff5a5f; outline-offset: 1px; }
  `;
  root.append(style);

  const box = document.createElement('div');
  box.className = 't';
  box.setAttribute('role', 'status');
  const text = document.createElement('div');
  text.className = 'm';
  text.textContent = message;
  box.append(text);

  let timer = 0;
  const close = () => host.remove();
  const arm = (ms: number) => {
    clearTimeout(timer);
    timer = window.setTimeout(close, ms);
  };

  if (linkId) {
    const move = document.createElement('select');
    move.setAttribute('aria-label', 'Move to collection');
    const placeholder = new Option('Move…', '', true, true);
    placeholder.disabled = true;
    move.append(placeholder, ...collections.map((c) => new Option(c, c)));
    move.addEventListener('focus', () => clearTimeout(timer));
    move.addEventListener('change', () => {
      chrome.runtime.sendMessage({ type: 'update', id: linkId, patch: { collection: move.value } });
      text.textContent = `Moved → ${move.value}`;
      arm(1800);
    });

    const undo = document.createElement('button');
    undo.textContent = 'Undo';
    undo.addEventListener('click', () => {
      chrome.runtime.sendMessage({ type: 'undoSave', id: linkId });
      text.textContent = 'Removed from Stash';
      move.remove();
      undo.remove();
      arm(1200);
    });
    box.append(move, undo);
  }

  root.append(box);
  document.documentElement.append(host);
  host.addEventListener('mouseenter', () => clearTimeout(timer));
  host.addEventListener('mouseleave', () => arm(2500));
  arm(4000);
}
