# Security

## Reporting a vulnerability

Please use GitHub's **private vulnerability reporting** (Security → Report a vulnerability) rather than a public issue. You'll get a response within a week.

## Threat model

Stash is a browser extension with no server. Your data lives in your browser's IndexedDB and, for sync, in a "Stash" folder in your Chrome bookmarks.

| Risk | What Stash does |
| --- | --- |
| **Hostile page content steering the AI** (prompt injection) | The model is never given tools that act. It can only return one fixed-shape object, and every field is type-checked, stripped of markup and control characters, and length-capped (`src/core/validate.ts`). Ranking results may only reference IDs that exist. |
| **AI output rendered as markup** | All text renders through Preact's escaping. `dangerouslySetInnerHTML` is a lint error. |
| **Unsafe links** (`javascript:`, `data:`, `file:`) | Only `http(s)` links can be opened, imported or exported. |
| **Secrets in URLs** | Credentials (`user:pass@`) and secret-looking query params (`token`, `key`, `sig`, `code`, `session`, …) are stripped before anything is stored or sent. |
| **Private pages sent to a model** | Page text is never read for hosts on the never-read list (localhost, private IPs, `*.internal`, `*.corp`, mail, banking, password managers). This list is editable. Nothing is captured in incognito. |
| **API key exposure** | An optional Claude key is kept in `chrome.storage.local` and used only by the background worker. It never reaches pages or content scripts. It is **not encrypted at rest**, so use a dedicated key with a spend limit. |
| **Over-broad permissions** | `tabs` and `<all_urls>` are optional and requested only when a feature needs them. Host access is limited to `api.anthropic.com`. |
| **Supply chain** | Few runtime dependencies (Preact, Dexie, MiniSearch, Readability), a pinned lockfile, Dependabot and CodeQL. MV3 forbids remote code. |

Stash has no telemetry. No usage data leaves your device.
