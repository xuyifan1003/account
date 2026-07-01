# AGENTS.md — 极简记账

## What this is
Vanilla JS PWA (no build, no npm, no backend). Single-page personal finance tracker in Chinese. Data persists to Supabase (PostgreSQL).

## Run
```
npx serve .
```

## Init order (js/app.js)
```
DOMContentLoaded → await initState → initTabs → initBook → initAssets → initReport → renderBookSummary → register SW
```

## Data flow
- **DB**: Supabase PostgreSQL via direct fetch() REST calls in `js/db.js`. No SDK, no CDN. Tables: `records`, `assets`
- **Read**: `initState()` → `api('GET', ...)` from Supabase, fail → empty defaults
- **Write**: `saveState()` → `api('POST', ...)` upsert all records + assets with `on_conflict=id`. Errors → console.warn
- **Delete**: MUST explicitly call `api('DELETE', 'records', null, 'id=eq.xxx')`. Upsert alone won't remove rows
- **RLS**: permissive — `ALL` operations allowed with `ANON` key

## Key conventions
- **State**: in-memory only, shape `{ records: [...], assets: [...] }`. No localStorage
- **Records** prepended (`unshift`). All 11 built-in categories are `type: 'expense'` — no income exists
- **IDs**: `Date.now().toString(36) + Math.random().toString(36).slice(2, 5)`
- **Amounts**: raw numbers, display with `.toFixed(2)`. Numpad: ≤10 integer digits, ≤2 decimals. Zero/negative → shake
- **Assets**: sorted by balance desc (not sort field). Default IDs pattern `asset-*`
- **Today's records**: auto-refresh every 60s via `setInterval` in `book.js`
- **Tab switching**: report and assets re-render per switch; book does not. Same-tab repeat clicks skipped (`currentTab` guard in `tabs.js`)
- **Record icons**: use `r.category` class for colored backgrounds (not `r.type`)
- **Haptic**: call `haptic()` from `utils.js` on all interactive elements (taps, toggles, confirms)

## Layout: scrolling only where needed
- **Book page**: `.book-sticky` (card + categories) fixed top, `.book-scroll` (records list only) fills rest and scrolls
- **Report page**: `.report-top` fixed, `.report-scroll` (categories) fills middle and scrolls, `.report-trend-fixed` sticks to bottom (hidden in month view)

## CSS
- All tokens via CSS custom properties in `variables.css`. `--primary` is `#3D3D3D` — keep hardcoded colors in sync with this
- Mobile-first, max-width 500px, safe-area-inset

## SW cache (network-first)
- Cache name `money-book-v16` in `sw.js:1` — **每次部署必须 bump**（如 `v16` → `v17`）
- PRECACHE list in `sw.js` must match actual files
- `clients.claim()` on activate → new SW takes over immediately

## No CI, tests, lint, typecheck, formatter, or package.json

## Communication
- AI 助手所有回复默认使用中文输出
