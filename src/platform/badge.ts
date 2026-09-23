import { badgeScope, matchesScope } from '../core/url';
import { db } from './db';

/** Shows how many saved links belong to the site or repo in the active tab. */
export async function updateBadge(tabId: number, url: string | undefined): Promise<void> {
  const scope = url ? badgeScope(url) : null;
  const count = scope
    ? await db.links.filter((l) => !l.archived && matchesScope(l.url, scope)).count()
    : 0;
  await chrome.action.setBadgeBackgroundColor({ color: '#ff5a5f', tabId });
  await chrome.action.setBadgeText({ text: count ? String(Math.min(count, 99)) : '', tabId });
  await chrome.action.setTitle({
    title: count ? `Stash: ${count} saved from ${scope}` : 'Stash',
    tabId,
  });
}

export async function refreshActiveBadge(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab?.id !== undefined) await updateBadge(tab.id, tab.url);
}
