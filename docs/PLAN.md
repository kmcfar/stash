# Stash — product & engineering plan

## Context
The bookmark bar was built for about 20 sites. Today we collect hundreds of links: docs, READMEs, GitHub Pages dashboards, Notion pages, reference sites. Bookmarks break in two places:
1. **Saving is slow.** Folders make you pick a place at the moment you save, so people skip saving and just keep tabs open.
2. **Finding is worse.** You have to remember which folder you picked months ago.

Most tools try to fix storage. **The real problem is getting links back.** Stash is a local-first, open-source browser extension that works like this:
- **Save** with one keystroke and no choices to make.
- **Sort** automatically, using AI.
- **Find** anything in under 3 seconds from the new tab page.

Decisions so far:
- a new public repo
- AI runs on Chrome's on-device model by default, and your own Claude key is an optional upgrade
- the new tab page plus a shortcut is where you find links
- links sync by mirroring into a Chrome bookmarks folder
- "why I saved this" is worked out automatically

## Product framing (the questions we answered first)
- **Who, specifically?** Builders and PMs who have 200+ links across docs, repos and dashboards. We're building for ourselves first.
- **Narrowest wedge (Gary Tan / gstack):** "Save in 1 key, find in 3 seconds." Anything that doesn't serve that sentence is out of v1.
- **Cagan's four risks:**
  - *Value:* will you really stop using the bookmark bar? We test this by dogfooding for 2 weeks.
  - *Usability:* saving must take zero decisions. Finding must work from the keyboard alone.
  - *Feasibility:* runs entirely in the extension, with no backend.
  - *Viability:* open source, free, no server bills, user owns their data.
- **Adoption blocker:** people's existing bookmarks. One-click import is part of v1, not a later extra.
- **Airbnb bar:** one clear primary action per screen, instant feedback (a toast within 100ms), undo instead of confirm dialogs, and a calm UI.

## Growth and retention review (the Meta/Instagram PM view)
- **The first-run "wow" happens in under 60 seconds.** Import runs by default and sorts your links using only titles and URLs, which is fast and cheap. The first screen you see says "Your 347 bookmarks, organized into 14 collections." That is the moment people screenshot. Full page summaries fill in quietly in the background afterwards.
- **No setup wall before AI works.** The default is Chrome's free, private on-device model (Gemini Nano, through the Prompt API). A Claude key is an optional upgrade for better quality. If neither is available, Stash falls back to grouping by site plus templates. Settings shows which of the three is active.
- **You keep sync and trust.** Every link is also written into a Chrome bookmarks folder called "Stash", with a subfolder per collection. That gives you:
  - sync across your devices through Chrome Sync, including Chrome on your phone
  - no lock-in: if you uninstall, your links stay put
  - a zero-risk switch, which is itself a selling point
- **Built for daily habit.** The new tab page is your daily trigger, and the Rediscover row brings back something useful each time you open it.
- **Chrome's "Change back to Google?" prompt** is the biggest risk of losing new users. The first new tab you see must already be better than Chrome's own: your imported library, sorted, not an empty page. Popup, address-bar search and the shortcut all still work if someone turns the new tab off.
- **Something useful from day one.** Before import, and for new users without bookmarks, the empty state shows one big "Import your bookmarks" button plus a 3-step shortcut guide. Never a blank page.
- **The most common real task: "save all my tabs."** One command saves every tab in the current window, and you can choose "save and close". The AI files them into one collection named after the tab group or topic. This is how tab hoarders switch over.
- **Stash reminds you what you already saved.** The toolbar icon shows a count badge when the site you're on has saved links ("3 saved from this repo"). This helps you remember what you have without searching.
- **Built-in sharing, which is also how Stash spreads.** Every collection has "Copy as Markdown", good for READMEs, PR descriptions and Slack. The Markdown ends with a small "via Stash" link that you can turn off.
- **Success metrics, kept on your device only** and shown on a "Your shelf" stats page. The same numbers tell us whether the product works while we dogfood it.
  - **North star:** successful finds per week, meaning a search followed by opening a result within 10 seconds.
  - **Also tracked:** saves per week, how long finding takes (typing to opening, median), searches that return nothing, how many links are ever opened again, and the share of new tab visits that lead to an action.
  - No numbers ever leave your device.

## Staff engineering review: what changed and why
**Security and privacy.** Page content is untrusted input going into an LLM. The API key is a secret stored in a browser.
- **Guard against prompt injection.** A page can include hidden text like "ignore instructions…". The model gets *no tools that do anything*. It can only return one fixed-shape object, and we check every field in `src/core/validate.ts` before using it:
  - length caps
  - `kind` must be one of the allowed values
  - collection names are cleaned up
  - Ask may return only IDs that exist in the library
- **The AI never writes HTML.** Everything is rendered as plain text through Preact's escaping. `dangerouslySetInnerHTML` is banned by a lint rule.
- **Only real web links open.** Only `http:` and `https:` URLs can be opened. `javascript:` bookmarklets and `data:`/`file:` links are kept when imported but can't be clicked. The HTML export escapes everything.
- **Clean URLs before saving or sending.** Normalization removes `user:pass@` from URLs and strips secret-looking query params (`token`, `key`, `sig`, `code`, `session`, `auth`) before storing or sending anything.
- **Privacy controls:**
  - A clear consent screen: "Stash sends trimmed page text to Anthropic with your key."
  - A **never-read list**, pre-filled with localhost, private IPs, `*.internal`, mail and banking patterns. Links from those sites are saved with metadata only.
  - Nothing is captured in incognito windows.
- **Least privilege.** Required permissions: `activeTab`, `scripting`, `storage`, `contextMenus`, `omnibox`, `alarms`, `tabGroups`, `bookmarks` (needed for the sync mirror), and host access to `https://api.anthropic.com/*` only. `tabs` and `<all_urls>` are *optional* and requested at the moment they are needed.
- **The key stays in the background worker.** It lives in `chrome.storage.local` and never reaches content scripts or pages. The README says plainly that it is stored unencrypted on disk. It recommends a dedicated key with a spending limit.
- **Safe page fetching for Enrich.** The background fetch uses `credentials: 'omit'` so it never sends your cookies and never pulls private logged-in content. It only accepts http(s), times out after 8 seconds, reads at most 1MB, and only accepts `text/html`.
- **Supply chain.** Few dependencies, a pinned lockfile, Dependabot and CodeQL in CI. No remote code, since MV3 forbids it anyway.

**Performance.** The new tab is the page you open most, so it has to feel instant.
- **Budgets:**
  - first paint under 50ms, usable under 150ms
  - new tab script under 50KB gzipped
  - at 10k links, a keystroke shows results in under 16ms
- **Swap React for Preact** (about 4KB, same way of writing components).
- **Paint the snapshot first, search second.** The page draws a cached "shelf snapshot" (pinned, recent and collections, stored in `chrome.storage.local`) right away. The search index loads after that. The MiniSearch index is saved in serialized form and updated one link at a time, never rebuilt on each page load.
- **Readability runs only when you save.** Mozilla Readability (well-tested content extraction) runs in the script injected at save time, so it adds nothing to the new tab's load.

**Reliability (the MV3 background worker gets shut down at any time).**
- **The AI queue lives in IndexedDB**, marked by `aiStatus='pending'`, not in memory. `chrome.alarms` resumes it on wake.
- **Retries:**
  - 429 and 529 errors: exponential backoff with jitter
  - other 4xx errors: marked as errors, no retry
- **One writer.** Only the background worker writes to the database. The UI pages send it typed messages and see updates live through Dexie `liveQuery`.
- **Versioned storage.** Dexie schema versions with migrations. Exports include `schemaVersion`.

**AI quality and cost.**
- **Force the output shape.** Force the tool call (`tool_choice`), temperature 0, and put the model ID in one setting.
- **Stable prompt first.** The system prompt and collection list come first so they can be prompt-cached once they pass the minimum cacheable length.
- **Keep Ask's cost flat as the library grows.** Search the library locally first (a loose OR query), then send only the top ~60 candidates to Haiku to rank. Without this, Ask gets more expensive with every link you save.
- **Keep categories tidy.** Soft cap of about 20 collections. The AI suggests merges instead of creating near-duplicate collections.
- **An eval set.** `evals/fixtures/` holds about 30 saved real pages with expected kind and collection. `pnpm eval` reports accuracy, how stable the categories stay, and $/link. We run it whenever the prompt changes, so we can tell whether a change actually helped.
- **Embeddings wait for v2.** Anthropic has no embeddings API, and a local model adds ~25MB. The AI-written keywords give most of the benefit for none of the weight.

**Code structure.**
- `src/core/` is pure TypeScript with no `chrome.*` calls: URL handling, validation, prompts, search and ranking. It is 100% unit-testable.
- `src/platform/` wraps the Chrome APIs.
- Messages between parts of the extension are typed with a discriminated union.

**Accessibility.**
- Search follows the ARIA combobox/listbox pattern.
- Full keyboard use and a visible focus ring.
- Motion is turned off when the user prefers reduced motion.

**Telemetry: none.** This is a privacy promise. There is a local debug log on the settings page instead.

## v1 scope

### Save
- Save with **Alt+Shift+S** or by clicking the toolbar icon. A toast appears on the page: "Saved → *Docs*" with **Undo** and **Move** buttons.
- The page script (injected only when you save, using `activeTab`, so no broad host permissions) reads:
  - the title and URL
  - the favicon
  - the meta and og description
  - the main text, extracted by Readability and capped at about 4k characters (skipped for sites on the never-read list)
- **Save first, AI later:** the database row is written and the toast shown right away. The AI result fills in the entry afterwards, and the toast updates to show the collection it was filed into.
- **Duplicates:** URLs are normalized (tracking params and trailing slashes stripped). Saving the same URL again updates the existing entry.
- **Right-click menu:** "Save link to Stash" works on any link.

### Understand (AI reads the page for you, cheaply)
The goal is that every saved link says what it is and why it matters, not just the page title.

**The AI backend is swappable.** One `AiProvider` interface (`summarize`, `summarizeBatch`, `describeCollection`, `rank`) with three implementations, picked in this order:
1. **Claude (`claude-haiku-4-5`)**, if you've added a key.
2. **Chrome built-in `LanguageModel`**, if its `availability()` check passes. It has a smaller context window, so the page text is capped at about 2k characters and the output schema is enforced with `responseConstraint`. Chrome needs you to click something before it downloads the model, so onboarding has an "Enable on-device AI" button. Ask narrows to about 20 candidates instead of 60.
3. **Heuristic fallback:** grouping by site, the page's meta description, and the template "why".

The same fixed output shape and checks (`validate.ts`) apply to every provider, and `pnpm eval` compares their accuracy.

**One AI call per save.** The page content is trimmed first:
- tags and navigation stripped, main content only
- capped at about 4k characters (roughly 1k tokens)
- `max_tokens` about 200

**The call returns one tool-use object:**
- `title`: a better title, such as "Stripe API — Webhooks signature verification" instead of "Docs".
- `summary`: 1–2 sentences on what the page is.
- `kind`: one of doc, repo, dashboard, article, tool, reference, video or other.
- `collection`: picked from your existing collections, or a new one if nothing fits.
- `tags[≤4]`
- `keywords[≤8]`: synonyms and terms you might search for that aren't on the page ("metrics", "KPIs", "Q3"). These are stored hidden and only used by search. They give you meaning-based matching without an embeddings setup.

**Cost:** about $0.002 per save (~1.2k input + ~150 output tokens at Haiku pricing), so 1,000 links cost about $2. Settings shows the running total.

**"Why I saved this" is worked out automatically. You never type it.** At save time Stash collects a small bundle of context, keeps it locally, and sends it with the same AI call (about 100 extra tokens):
- the referrer, i.e. the page you came from
- the name of the tab group the page is in, if any (e.g. "Q3 planning")
- the title and domain of the tab that opened this page
- up to 8 titles and domains of other tabs in the same window, with never-read sites removed

The model returns `why`, one line such as "Reference for webhook signing while working on agentic-email" or "Found via HN thread on local-first apps". It is shown on the link, searched along with everything else, and can be edited with one click.
- **Without a key**, `why` is a plain template: "Saved from ⟨referrer site⟩ · in group ⟨Q3 planning⟩".
- **Permission:** reading other tabs' titles needs the `tabs` permission, which Chrome warns about. It is optional and requested once during onboarding: "Let Stash use your open tabs to explain why you saved something." If you say no, `why` uses only the referrer and tab group, which need no warning.

**Categories:** the prompt includes your existing collection names, so the categories stay stable over time.
- Flat collections plus tags, no nested folders.
- You can rename or merge collections, and those changes are sent back to the AI in later calls.

**With no AI available** (no key and no on-device model): links are grouped by site (github.com/org, docs.x.com…) and use the page's meta description. The app is fully usable either way.

**Imported bookmarks** have no page text. An "Enrich my imported links" button fetches each page in the background, about 4 at a time, then summarizes them in batches of about 10. It asks for optional host permission at that moment only. A progress bar shows how far along it is, and you can pause it.

### Know what you have (so 200+ links stay understandable)
- **Library view** on the new tab page (shown when the search box is empty):
  - each collection is a card with an AI-written one-line description, a link count and its top 3 links
  - the description is refreshed only when the collection changes a lot (e.g. +5 links), so it stays cheap
- **Rich rows:** each result shows:
  - favicon, the better title, the summary, the kind badge and the site
  - the saved date and the "why" line
  - "Opened N times / never opened"
- **Rediscover row:** 3 links you saved but haven't opened in 60+ days. Each can be opened, kept, or archived with one click. This keeps the library from rotting.
- **Ask (fallback):** if normal search finds nothing good, press Tab or click "Ask Stash" to ask in plain language, e.g. "that dashboard with the churn numbers".
  - Stash first finds about 60 likely candidates with local search. Only those go to Haiku, as better title + summary (about 30 tokens each), and Haiku picks the best matches by ID.
  - Cost stays at about $0.002 per question no matter how big the library gets.
  - Only runs when you ask for it, never on each keystroke.

### Find
- **New tab page** with an autofocused search box. Results update as you type (MiniSearch fuzzy search over title, URL, summary, tags and collection).
- **Keyboard:** ↑/↓ to move, Enter to open, Cmd/Ctrl+Enter to open in a background tab.
- **Empty state** (the part that replaces the bookmark bar):
  - **Pinned** row, up to about 8 links
  - **Recent**
  - **Most opened**
  - collections as cards
- **Address bar:** type `s ` and then a search term to get suggestions right in the address bar.
- **Popup** (toolbar icon or shortcut): the same search, plus "Saved from this site", which lists your links that match the current domain or repo.

### Save many at once
- **"Save window" command** (in the popup, and as an optional shortcut): saves every tab in the window, with an option to close them afterwards. Metadata is read from the tabs themselves, so no script is injected into each page. Page text for summaries is fetched later by the enrich job.
- **Icon badge:** a count of saved links for the current site or GitHub repo (`tabs.onActivated` / `onUpdated` → count lookup in the database).

### Sync by mirroring to Chrome bookmarks
- The background worker writes each link into `Other bookmarks/Stash/<Collection>/`. Moving or renaming a collection moves or renames its folder.
- `bookmarks.onCreated/onChanged/onRemoved/onMoved` listeners bring in changes that arrive from other devices through Chrome Sync. New URLs are queued for enrichment.
- **No echo loops:** a short-lived set of the bookmark IDs Stash just wrote. When a listener fires for one of those, it is ignored.
- **Only the "Stash" folder is managed.** Your other bookmarks are never touched after import.
- **AI details stay local.** Summary, why and keywords are rebuilt on each device (cheap). A future version could sync them through a Gist.
- **Permission:** `bookmarks` becomes a *required* permission. It fits what the product is, and Chrome's warning ("Read and change your bookmarks") is expected for a bookmarks tool.

### Own your data
- Import from Chrome bookmarks in one click during onboarding. Folder names become the starting collections, and the first sort uses only titles and URLs, so the first-run wow takes seconds.
- **"Copy as Markdown"** on each collection. The "via Stash" footer can be turned off.
- Export to JSON and to Netscape HTML, so you can go back to any browser's bookmarks.
- **Settings page:** API key (stored in `chrome.storage.local`, never synced), shortcut help, export, and a "Re-sort all with AI" button.

### Non-goals for v1
Accounts, a hosted backend, public share pages, a mobile app (Chrome's bookmark sync covers basic phone access), full-page archiving, and read-later/highlights.

Possible v2: syncing AI details through a GitHub Gist, publishing collections as GitHub Pages, stale/dead link checks, and Firefox/Safari builds.

## Tech stack
- **WXT** (MV3 framework, cross-browser-ready), **TypeScript** (strict), **Preact** for the UI, plain CSS with variables (light and dark).
- **Dexie** (IndexedDB) for storage, **MiniSearch** for search (serialized index), and **@mozilla/readability** for extraction (injected only at save time).
- **Biome** for linting and formatting, **Vitest** for tests, **Playwright** for one end-to-end smoke test.
- **Direct fetch to the Anthropic API** with the `anthropic-dangerous-direct-browser-access` header. No SDK, so the bundle stays small.
- **License:** MIT.
- **CI:** GitHub Actions runs typecheck, lint, tests, build and the bundle-size budget check, then uploads the extension zip as an artifact. Dependabot and CodeQL run too.

### Data model (`src/lib/types.ts`)
```ts
Link {
  id, url, normalizedUrl, title, description, favicon, site,
  aiTitle?, summary?, kind?, keywords: string[], why?,
  context: { referrer?, tabGroup?, openerTitle?, windowTabs?: {title, site}[] },
  tags: string[], collection,
  pinned: boolean, createdAt, lastOpenedAt?, openCount,
  source: 'capture' | 'import',
  aiStatus: 'none' | 'pending' | 'done' | 'error'
}
```
A small `collections` table stores `{name, description, linkCountAtDescribe}` for the library view's cached descriptions. Link membership lives on each link, and renames and merges are batch updates.

### Repo layout
```
shelf/
  wxt.config.ts  package.json  biome.json  README.md  LICENSE
  entrypoints/
    background.ts       # commands, context menu, omnibox, AI queue
    newtab/             # main find surface (App.tsx, main.tsx, style.css)
    popup/              # quick search + "saved from this site"
    options/            # key, import/export, re-sort
  src/core/             # pure, no chrome.* — fully unit-tested
    types.ts  messages.ts   # Link model, typed message union
    url.ts              # normalize, strip secrets, safe-to-open, site grouping
    validate.ts         # AI output + import validation
    prompts.ts          # system prompt, tool schemas
    search.ts           # MiniSearch config, ranking, Ask candidate prefilter
    import.ts / export.ts
  src/platform/
    db.ts               # Dexie schema, migrations (background is sole writer)
    ai/                 # AiProvider interface + claude.ts, chromeBuiltin.ts, heuristic.ts
    mirror.ts           # two-way sync with the "Stash" bookmarks folder
    stats.ts            # local-only metrics
    badge.ts            # per-site saved count
    queue.ts            # persistent AI queue + alarms
    capture.ts          # injected: Readability + metadata
  src/ui/               # SearchBox (combobox), LinkRow, CollectionCard, Toast
  evals/                # fixtures + run.ts (pnpm eval)
  tests/                # vitest unit tests + e2e/smoke.spec.ts
  .github/workflows/ci.yml
```

## Milestones (each one is a commit that ships)
1. **Scaffold:** WXT + Preact + Biome + Vitest + CI (with bundle budget) + Dependabot/CodeQL + README + MIT license + SECURITY.md (threat model and how to report a vulnerability).
2. **Save:** shortcut, context menu, metadata extraction, Dexie, dedup, toast with undo.
3. **Find:** new tab search, keyboard navigation, pinned/recent/most-opened sections, address-bar keyword, popup.
4. **Own data and sync:**
   - Chrome bookmark import
   - two-way mirror to the "Stash" bookmarks folder
   - JSON, HTML and Markdown export
   - save window
   - icon badge
   - onboarding screen
5. **AI:**
   - provider interface: Chrome built-in, Claude key, heuristic fallback
   - first-run fast sort using titles and URLs only
   - per-save summary, better title, kind and hidden keywords
   - automatic "why": context capture (referrer, tab group, opener tab, other tabs in the window) plus the no-key template
   - "Enrich my imported links" batch job
   - rename/merge collections
   - cost counter
6. **Know what you have:** library view with collection descriptions, rich rows, Rediscover row, the Ask fallback, and the local "Your shelf" stats page.
7. **Polish and ship:**
   - empty states, dark mode
   - README with GIF
   - privacy policy on GitHub Pages
   - release workflow (tag → zip → GitHub Release → `wxt submit`)
   - store listing text and screenshots

## Install and deploy (checked)
**For users: yes, easy, but only once it's on the Chrome Web Store.**
- **The real path:** Chrome Web Store → "Add to Chrome" → the new tab opens onboarding → one-click import. After install there is nothing to configure: no account, no key, no server.
- **The same store listing works in Edge, Brave and Arc**, since they are all Chromium-based.
- **"Load unpacked"** (from the GitHub Release zip) needs Developer mode. It is documented for developers only, not the main path. Chrome blocks installing packaged extensions from outside the store, so there is no one-click install without the store.
- **Before the store, we need:**
  - a one-time $5 developer account
  - a privacy policy, as `docs/privacy.md` served on GitHub Pages
  - Data Usage disclosures (page text sent to Anthropic only when you add your own key; on-device otherwise)
  - screenshots
  - a single-purpose statement: "bookmark manager and new tab"
- **Review time:** expect a few days. Keeping `tabs` and `<all_urls>` optional keeps the review lighter.
- **Honest caveat about on-device AI:** Chrome's built-in model needs:
  - desktop Chrome 138 or newer
  - capable hardware (roughly 4GB+ of graphics memory, or 16GB of RAM on newer versions)
  - about 22GB of free disk space
  - a one-time model download of a few GB

  Many machines won't qualify. Onboarding checks `availability()` and presents the result as normal: "On-device AI: ready / downloading / not supported → add a Claude key for smarter sorting, or keep going without it." The product must feel complete on the heuristic fallback. The first-run wow (organized by site plus your old folder names) still works without AI.
- **Shortcut clashes:** if Alt+Shift+S is already taken, onboarding shows a link to `chrome://extensions/shortcuts` so you can pick another.

**For you, the maintainer: very easy, because there is no backend.** Nothing to host, monitor or pay for.
- **Develop:** `pnpm i && pnpm dev`. WXT opens Chromium with the extension loaded and reloads it as you edit. You need Node 20+ and pnpm, pinned through `packageManager`.
- **Release:** push a `v*` tag. `.github/workflows/release.yml` then:
  - builds and zips the extension
  - attaches the zip to a GitHub Release
  - runs `wxt submit` to upload to the Chrome Web Store, using the store API credentials saved as GitHub secrets
  - Edge Add-ons can be added to that same step later.
- **The first store submission is done by hand** (listing, screenshots, privacy answers). After that, every release is just a tag.
- **README install section:**
  - "Add to Chrome" button
  - dev setup in 3 commands
  - troubleshooting (on-device AI status, shortcut clashes, where your data lives)

## Verification
- **Unit tests (Vitest):**
  - URL normalization and dedup
  - search ranking
  - Chrome bookmark tree → links
  - export round-trip
  - AI response parsing and fallback, with a mocked `fetch`
  - the page-text trimmer stays under the character cap
  - hidden keywords make a search for "KPIs" match a page titled "Metrics dashboard"
  - Ask returns only IDs that actually exist
  - **Security:** a prompt-injection fixture page can't produce output outside the fixed shape, a `javascript:` import can't be opened, secret query params are stripped, and the export escapes HTML
  - **Background worker restart:** a pending queue item survives a restart and gets processed once the worker comes back
  - **Sync mirror** (with a mocked `chrome.bookmarks`): changes mirror in both directions and don't bounce back and forth, and bookmarks outside the Stash folder are never changed
  - **Provider choice:** Claude key, then Chrome built-in, then heuristic, and every provider's output passes the same checks
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass, and CI is green.
- **End-to-end:** Playwright launches the pre-installed Chromium with the unpacked `.output/chrome-mv3` build. The test:
  - opens a local fixture page
  - runs the save command and asserts a Dexie row exists
  - opens the new tab, types a query, and asserts the result appears
  - checks that Enter opens the link
  - Anthropic is mocked with Playwright route interception, so no real key is needed in CI
- **Performance:**
  - a script seeds 10k links
  - Playwright measures new tab first paint and keystroke-to-results time against the budgets
  - CI fails if the new tab bundle goes over 50KB gzipped
- `pnpm eval`, run locally with a real key, reports accuracy and $/link on the fixtures.
- **Install check:**
  - a fresh Chromium profile, with the release zip loaded unpacked, goes through onboarding, import, first save and first find with no AI available
  - a dry run of the release workflow (`wxt zip`, then `wxt submit --dry-run`) passes in CI
- **Manual (by you):**
  - load the extension unpacked
  - import your real bookmarks
  - use it for 2 weeks with the bookmark bar hidden
  - Success means you never un-hide the bookmark bar.
