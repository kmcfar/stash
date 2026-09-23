import type { SaveContext } from '../core/types';
import { isNeverRead, siteOf } from '../core/url';
import { cleanText } from '../core/validate';

const MAX_WINDOW_TABS = 8;

async function hasTabsPermission(): Promise<boolean> {
  return chrome.permissions.contains({ permissions: ['tabs'] });
}

/**
 * Gathers the signals used to infer "why I saved this". The tab group needs no
 * warning-bearing permission; opener and sibling tab titles need the optional
 * `tabs` permission and are simply skipped without it.
 */
export async function gatherContext(
  tab: chrome.tabs.Tab,
  referrer: string | undefined,
  neverRead: string[],
): Promise<SaveContext> {
  const context: SaveContext = {};
  if (referrer && !isNeverRead(referrer, neverRead)) context.referrer = referrer;

  if (tab.groupId !== undefined && tab.groupId !== -1) {
    try {
      const group = await chrome.tabGroups.get(tab.groupId);
      if (group.title) context.tabGroup = cleanText(group.title, 60);
    } catch {
      // Group closed between save and lookup.
    }
  }

  if (!(await hasTabsPermission())) return context;

  if (tab.openerTabId !== undefined) {
    try {
      const opener = await chrome.tabs.get(tab.openerTabId);
      if (opener.url && opener.title && !isNeverRead(opener.url, neverRead)) {
        context.openerTitle = cleanText(opener.title, 100);
      }
    } catch {
      // Opener already closed.
    }
  }

  const siblings = await chrome.tabs.query({ windowId: tab.windowId });
  context.windowTabs = siblings
    .filter((t) => t.id !== tab.id && t.url && t.title && !isNeverRead(t.url, neverRead))
    .slice(0, MAX_WINDOW_TABS)
    .map((t) => ({ title: cleanText(t.title, 80), site: siteOf(t.url ?? '') }));
  return context;
}
