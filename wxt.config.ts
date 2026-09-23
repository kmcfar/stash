import preact from '@preact/preset-vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  srcDir: '.',
  vite: () => ({ plugins: [preact()] }),
  manifest: {
    name: 'Stash',
    description: 'Replace the bookmark bar. Save any link in one key, find it in three seconds.',
    permissions: [
      'activeTab',
      'scripting',
      'storage',
      'contextMenus',
      'alarms',
      'bookmarks',
      'tabGroups',
      'favicon',
    ],
    optional_permissions: ['tabs'],
    host_permissions: ['https://api.anthropic.com/*'],
    optional_host_permissions: ['<all_urls>'],
    omnibox: { keyword: 's' },
    commands: {
      'save-page': {
        suggested_key: { default: 'Alt+Shift+S' },
        description: 'Save the current page to Stash',
      },
      _execute_action: {
        suggested_key: { default: 'Alt+Shift+F' },
        description: 'Search your Stash',
      },
    },
    incognito: 'not_allowed',
  },
});
