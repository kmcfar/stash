import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { type BrowserContext, chromium, expect, test } from '@playwright/test';

const EXTENSION = path.resolve('.output/chrome-mv3');

let context: BrowserContext;
let extensionId: string;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext(mkdtempSync(path.join(tmpdir(), 'stash-')), {
    channel: 'chromium',
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
  });
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  extensionId = new URL(worker.url()).host;
  await context.route('https://docs.example.test/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<title>Webhooks guide</title><h1>Webhooks</h1>',
    }),
  );
});

test.afterAll(async () => {
  await context.close();
});

/** Seed a link straight into the extension's IndexedDB, as the background worker would. */
async function seed(page: import('@playwright/test').Page) {
  await page.evaluate(async () => {
    const open = indexedDB.open('stash');
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const tx = db.transaction('links', 'readwrite');
    tx.objectStore('links').put({
      id: 'seed-1',
      url: 'https://docs.example.test/webhooks',
      normalizedUrl: 'https://docs.example.test/webhooks',
      title: 'Webhooks guide',
      description: '',
      site: 'docs.example.test',
      aiTitle: 'Payments webhooks — signature verification',
      summary: 'How to verify webhook signatures.',
      keywords: ['hmac', 'security'],
      context: {},
      why: 'Saved from news.ycombinator.com',
      tags: [],
      collection: 'Payments',
      pinned: false,
      archived: false,
      createdAt: Date.now(),
      openCount: 0,
      source: 'capture',
      aiStatus: 'none',
      aiAttempts: 0,
    });
    await new Promise((resolve) => {
      tx.oncomplete = resolve;
    });
    db.close();
  });
}

test('new tab welcomes, finds a saved link by meaning, and opens it', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/newtab.html`);
  await expect(page.getByText('Your links, finally findable.')).toBeVisible();

  await seed(page);
  await page.reload(); // raw IndexedDB writes bypass Dexie's live-update broadcast
  await expect(page.getByRole('heading', { name: 'Payments' })).toBeVisible();

  const box = page.getByRole('combobox', { name: 'Search your Stash' });
  await expect(box).toBeFocused();
  await box.fill('hmac');
  await expect(page.getByRole('option')).toHaveCount(1);
  await expect(page.getByRole('option')).toContainText('signature verification');
  await expect(page.getByRole('option')).toContainText('Saved from news.ycombinator.com');

  await box.press('Enter');
  await page.waitForURL('https://docs.example.test/webhooks');

  const again = await context.newPage();
  await again.goto(`chrome-extension://${extensionId}/newtab.html`);
  await again.getByRole('combobox').fill('webhooks');
  await expect(again.getByRole('option')).toContainText('Opened 1×');
});
