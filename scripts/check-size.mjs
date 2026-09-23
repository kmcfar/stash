// Fails the build if the new tab's JavaScript grows past its budget.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 50;
const dir = '.output/chrome-mv3';
const html = readFileSync(join(dir, 'newtab.html'), 'utf8');
const scripts = [...html.matchAll(/(?:src|href)="\/?(chunks\/[^"]+\.js)"/g)].map((m) => m[1]);
const chunks = new Set(scripts);
// Include chunks imported by the entry chunks.
for (const file of [...chunks]) {
  const code = readFileSync(join(dir, file), 'utf8');
  for (const m of code.matchAll(/from"\.\/([^"]+\.js)"/g)) chunks.add(`chunks/${m[1]}`);
}
if (!chunks.size) throw new Error('No new tab chunks found; did the build change shape?');
const bytes = [...chunks].reduce((sum, f) => sum + gzipSync(readFileSync(join(dir, f))).length, 0);
const kb = bytes / 1024;
console.log(
  `New tab JS: ${kb.toFixed(1)} KB gzipped (budget ${BUDGET_KB} KB) from ${[...chunks].join(', ')}`,
);
if (kb > BUDGET_KB) process.exit(1);
