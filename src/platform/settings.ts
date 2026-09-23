import { defaultNeverRead } from '../core/url';

export interface Settings {
  neverRead: string[];
  markdownFooter: boolean;
  onboarded: boolean;
}

const DEFAULTS: Settings = {
  neverRead: defaultNeverRead(),
  markdownFooter: true,
  onboarded: false,
};

/** Non-secret preferences. The API key is stored separately and only read by the background. */
export async function getSettings(): Promise<Settings> {
  const stored = await chrome.storage.local.get('settings');
  return { ...DEFAULTS, ...(stored.settings as Partial<Settings> | undefined) };
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ settings: next });
  return next;
}
