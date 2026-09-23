import { defineBackground } from 'wxt/utils/define-background';
import type { Request } from '../src/core/messages';
import { createIndex, type LinkIndex, searchLinks } from '../src/core/search';
import { trimPageText } from '../src/core/text';
import { displayTitle, type Link } from '../src/core/types';
import { isNeverRead, isOpenable } from '../src/core/url';
import { refreshActiveBadge, updateBadge } from '../src/platform/badge';
import { gatherContext } from '../src/platform/context';
import { collectionNames, db } from '../src/platform/db';
import { getSettings } from '../src/platform/settings';
import * as store from '../src/platform/store';
import { showToast } from '../src/platform/toast';
import type { CaptureResult } from './capture';

const PAGE_TEXT_CHARS = 4000;

export default defineBackground(() => {
  chrome.runtime.onInstalled.addListener(({ reason }) => {
    chrome.contextMenus.create({
      id: 'save-link',
      title: 'Save link to Stash',
      contexts: ['link'],
    });
    chrome.contextMenus.create({
      id: 'save-page',
      title: 'Save page to Stash',
      contexts: ['page'],
    });
    if (reason === 'install') chrome.tabs.create({ url: chrome.runtime.getURL('/newtab.html') });
  });

  chrome.commands.onCommand.addListener(async (command, tab) => {
    if (command === 'save-page' && tab) await saveTab(tab);
  });

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'save-page' && tab) await saveTab(tab);
    if (info.menuItemId === 'save-link' && info.linkUrl && isOpenable(info.linkUrl)) {
      const { link } = await store.saveLink({
        url: info.linkUrl,
        title: info.selectionText,
        context: tab?.url ? { referrer: tab.url } : {},
      });
      changed();
      if (tab?.id !== undefined) await toast(tab.id, `Saved → ${link.collection}`, link.id);
    }
  });

  chrome.tabs.onActivated.addListener(({ tabId }) => {
    chrome.tabs.get(tabId).then(
      (t) => updateBadge(tabId, t.url),
      () => {},
    );
  });
  chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
    if (info.url || info.status === 'complete') updateBadge(tabId, tab.url).catch(() => {});
  });

  setupOmnibox();

  chrome.runtime.onMessage.addListener((message: Request, sender, sendResponse) => {
    handle(message, sender).then(sendResponse, (error: unknown) =>
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) }),
    );
    return true;
  });
});

// ---- Search index for the omnibox (UI pages build their own) ----

let index: LinkIndex | null = null;
let byId = new Map<string, Link>();

async function getIndex(): Promise<{ index: LinkIndex; byId: Map<string, Link> }> {
  if (!index) {
    const links = await db.links.toArray();
    byId = new Map(links.map((l) => [l.id, l]));
    index = createIndex(links);
  }
  return { index, byId };
}

/** Called after every write: drop caches that depend on the link table. */
function changed(): void {
  index = null;
  refreshActiveBadge().catch(() => {});
}

// ---- Save ----

async function saveTab(
  tab: chrome.tabs.Tab,
): Promise<Awaited<ReturnType<typeof store.saveLink>> | null> {
  if (!tab.url || !isOpenable(tab.url) || tab.incognito) return null;
  const settings = await getSettings();
  const readable = !isNeverRead(tab.url, settings.neverRead);

  let captured: CaptureResult | undefined;
  if (readable && tab.id !== undefined) {
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['/capture.js'],
      });
      captured = result?.result as CaptureResult | undefined;
    } catch {
      // Restricted page (e.g. the Web Store). Save with tab metadata only.
    }
  }

  const context = await gatherContext(tab, captured?.referrer, settings.neverRead);
  const outcome = await store.saveLink({
    url: tab.url,
    title: captured?.title || tab.title,
    description: captured?.description,
    favicon: captured?.favicon || tab.favIconUrl,
    pageText: captured?.text ? trimPageText(captured.text, PAGE_TEXT_CHARS) : undefined,
    context,
  });
  changed();

  if (tab.id !== undefined) {
    const prefix = outcome.duplicate ? 'Already saved' : 'Saved';
    await toast(tab.id, `${prefix} → ${outcome.link.collection}`, outcome.link.id);
  }
  return outcome;
}

async function toast(tabId: number, message: string, linkId: string | null): Promise<void> {
  try {
    const collections = await collectionNames();
    await chrome.scripting.executeScript({
      target: { tabId },
      func: showToast,
      args: [message, linkId, collections],
    });
  } catch {
    // Toasts can't render on restricted pages; the badge still updates.
  }
}

async function saveWindow(close: boolean): Promise<number> {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  let saved = 0;
  for (const tab of tabs) {
    if (!tab.url || !isOpenable(tab.url) || tab.pinned) continue;
    await store.saveLink({ url: tab.url, title: tab.title, favicon: tab.favIconUrl });
    saved++;
  }
  changed();
  if (close) {
    const ids = tabs
      .filter((t) => t.url && isOpenable(t.url) && !t.pinned && !t.active)
      .map((t) => t.id);
    await chrome.tabs.remove(ids.filter((id): id is number => id !== undefined));
  }
  return saved;
}

// ---- Omnibox: type "s " then a query in the address bar ----

function escapeXml(text: string): string {
  return text.replace(/[<>&'"]/g, (c) => `&#${c.charCodeAt(0)};`);
}

function setupOmnibox(): void {
  chrome.omnibox.setDefaultSuggestion({ description: 'Search your Stash' });
  chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
    const { index: idx, byId: map } = await getIndex();
    const results = searchLinks(idx, text, map, 6);
    suggest(
      results.map((l) => ({
        content: l.url,
        description: `${escapeXml(displayTitle(l))} <dim>${escapeXml(l.collection)}</dim> <url>${escapeXml(l.site)}</url>`,
      })),
    );
  });
  chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
    let target = text;
    if (!isOpenable(text)) {
      const { index: idx, byId: map } = await getIndex();
      const [top] = searchLinks(idx, text, map, 1);
      if (!top) {
        await chrome.tabs.create({
          url: `${chrome.runtime.getURL('/newtab.html')}?q=${encodeURIComponent(text)}`,
        });
        return;
      }
      target = top.url;
    }
    const link = await store.findByUrl(target);
    if (link) await store.recordOpen(link.id);
    if (disposition === 'currentTab') await chrome.tabs.update({ url: target });
    else await chrome.tabs.create({ url: target, active: disposition === 'newForegroundTab' });
  });
}

// ---- Messages from UI pages and toasts ----

async function handle(message: Request, sender: chrome.runtime.MessageSender): Promise<unknown> {
  switch (message.type) {
    case 'saveTab': {
      const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      const outcome = tab ? await saveTab(tab) : null;
      return outcome ? { ok: true, ...outcome } : { ok: false, error: 'This page can’t be saved.' };
    }
    case 'saveWindow':
      return { ok: true, saved: await saveWindow(message.close) };
    case 'open': {
      const link = await store.recordOpen(message.id);
      if (!link || !isOpenable(link.url)) return { ok: false, error: 'Not openable' };
      if (message.background) await chrome.tabs.create({ url: link.url, active: false });
      else if (sender.tab?.id !== undefined)
        await chrome.tabs.update(sender.tab.id, { url: link.url });
      else await chrome.tabs.create({ url: link.url });
      changed();
      return { ok: true };
    }
    case 'update':
      await store.updateLink(message.id, message.patch);
      changed();
      return { ok: true };
    case 'delete':
    case 'undoSave':
      await store.deleteLink(message.id);
      changed();
      return { ok: true };
    case 'renameCollection':
      await store.renameCollection(message.from, message.to);
      changed();
      return { ok: true };
    default:
      return { ok: false, error: `Not supported yet: ${message.type}` };
  }
}
