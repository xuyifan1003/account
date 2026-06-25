# AGENTS.md — 极简记账

## What this is
Vanilla JS PWA (no build tools, no npm, no backend). A single-page personal finance tracker in Chinese.

## Project structure
```
index.html          — app shell + modals (numpad, asset form)
css/
  variables.css     — design tokens (colors, radii, shadows, dimensions)
  layout.css        — header, pages, tab bar, page transitions
  components.css    — categories grid, records list, modals, numpad, buttons, toast
  pages.css         — assets page, report page, chart
js/
  app.js            — entry point (init order matters, see below)
  state.js          — categories definition, localStorage state, category lookup
  book.js           — book tab: category grid, today's records, numpad modal
  assets.js         — assets tab: list, add/edit/delete
  report.js         — report tab: month nav, income/expense, category chart
  tabs.js           — tab switching
  utils.js          — date helpers, formatMoney, genId, showToast, shakeElement
sw.js               — service worker (cache name: `money-book-v2`)
manifest.json       — PWA manifest
```

## How to run
No server needed. Open `index.html` in a browser directly, or use any static file server:
```
npx serve .
```

## Initialization order (js/app.js)
```
DOMContentLoaded → initState → getToday → initTabs → initBook → initAssets → initReport → register SW
```

## State & persistence
- All data in `localStorage` key `money_state`
- Shape: `{ records: [...], assets: [...] }`
- `saveState()` writes to localStorage immediately; no debouncing
- Records are transient — no backup or export

## CSS conventions
- All colors, sizes via CSS custom properties in `variables.css`
- No utility framework, no preprocessor
- Mobile-first, max-width: 500px, safe-area-inset support

## JS conventions
- Native ES modules (`type="module"` on script tag)
- No framework, no router, no state library
- Each module exports `init*` (called once at startup), `render*` (idempotent re-render)
- IDs generated via `Date.now().toString(36) + random` in `genId()`
- Amounts stored as raw numbers, displayed with `.toFixed(2)`

## SW cache
- Update `CACHE` constant in `sw.js` (currently `money-book-v2`) when adding/renaming assets
- PRECACHE list in `sw.js` must match actual assets
- Registers in `app.js` on DOMContentLoaded

## Communication
- AI 助手所有回复默认使用中文输出

## What's NOT configured
- No CI, no tests, no linting, no formatting, no type checking
- No package.json, no node_modules
- No backend, no API, no database
