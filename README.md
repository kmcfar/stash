# Stash

**Replace the bookmark bar.** Save any link in one click, and find it again in three seconds.

The bookmark bar was built for about 20 sites. Today we collect hundreds of links: docs, READMEs, GitHub Pages dashboards and reference sites. Folders make you pick a place the moment you save, and then you have to remember that place months later. Stash drops the folders:

- **Save** by clicking the Stash icon next to your address bar, like the ⭐ star. There are no choices to make. The popup confirms the save and lets you move or remove it. <kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd> also works.
- **Understand.** Stash reads the page and records what it is and *why you saved it* (where you came from and which tab group you were in), so a link called "Docs" is still meaningful 200 links later.
- **Find** from your new tab. Start typing and results appear as you type. Search covers titles, summaries, sites, collections and hidden keywords, so `kpis` finds "Metrics dashboard". You can also type `s` and then a search term in the address bar.

It's local-first and open source. There are no accounts, no servers and no telemetry.

## Status

Early, working, and being dogfooded.

| | |
| --- | --- |
| ✅ | Save a page in one click from the toolbar icon, or with the shortcut or right-click menu. Duplicates are detected, and you can move or remove the link right away. |
| ✅ | Short descriptions for every link, taken from the page's own description or its opening text. |
| ✅ | Delete any link from the new tab, with Undo. <kbd>⌘</kbd>/<kbd>Ctrl</kbd>+<kbd>⌫</kbd> deletes the highlighted search result. |
| ✅ | Right-click any link to save it. "Save all tabs" saves every tab in the window, optionally closing them. |
| ✅ | "Why I saved this" is filled in automatically from the referrer and tab group, plus opener and sibling tabs if you allow it. |
| ✅ | New tab page with live, fuzzy, keyboard-only search, plus Pinned, Recent, Most opened, Rediscover and Collections. |
| ✅ | Address-bar keyword `s`, a toolbar popup with "Saved from this site", and a per-site count badge. |
| 🚧 | AI filing, better titles, summaries and keywords using on-device Chrome AI by default or your own Claude key. |
| 🚧 | One-click import of your Chrome bookmarks, and sync by mirroring into a "Stash" bookmarks folder. |
| 🚧 | Export to JSON, HTML and Markdown. Settings. Ask Stash in plain language. |

## Install

**From source** (until the Chrome Web Store listing is live):

```sh
pnpm install
pnpm build
```

Then open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and choose `.output/chrome-mv3`. This works in Chrome, Edge, Brave and Arc.

**Pin it:** click the 🧩 Extensions menu at the top right of Chrome, then click the pin next to Stash. Its icon then sits beside your address bar, and one click saves the page you're on. (Chrome only lets its own features, like the star, go *inside* the address bar. A pinned icon is the closest spot.)

If the shortcut is already taken, change it at `chrome://extensions/shortcuts`.

## Develop

```sh
pnpm install
pnpm dev          # opens Chromium with the extension loaded and reloads it as you edit
pnpm test         # unit tests (Vitest)
pnpm test:e2e     # loads the built extension in Chromium (Playwright)
pnpm lint && pnpm typecheck
```

### How it's built

- **[WXT](https://wxt.dev)** (Manifest V3) with **Preact** and plain CSS. The new tab stays under 50 KB gzipped, and CI enforces that budget.
- **Dexie** (IndexedDB) for storage, **MiniSearch** for search, and **Readability** for extracting page text. Readability is injected only when you save a page.
- `src/core/` is pure TypeScript with no browser APIs, so it is fully unit-testable. `src/platform/` wraps Chrome's APIs.
- Only the background worker writes to the database. UI pages read it live and send typed messages (`src/core/messages.ts`) to change it.

```
entrypoints/   background, newtab, popup, capture (injected on save)
src/core/      url, search, library, validate, transfer, links, types
src/platform/  db, store, context, badge, toast, settings
src/ui/        Search, LinkRow, data hooks, style.css
```

## Privacy and security

Everything stays in your browser. Page text is never read on private hosts (localhost, intranet, mail, banking and password managers). Only `http(s)` links can be opened, and secret-looking URL parameters are stripped before saving. See [SECURITY.md](SECURITY.md) for the full threat model.

## License

[MIT](LICENSE)
