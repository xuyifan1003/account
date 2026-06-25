# AGENTS.md — 极简记账

## What this is
Vanilla JS PWA (no build, no npm, no backend). Single-page personal finance tracker in Chinese.

## Run
```
npx serve .
```
Or open `index.html` directly.

## Init order (js/app.js)
```
DOMContentLoaded → initState → initTabs → initBook → initAssets → initReport → renderBookSummary → register SW
```

## Key conventions
- **State**: localStorage key `money_state`, shape `{ records: [...], assets: [...] }`, saved synchronously via `saveState()`
- **Records** are prepended (`unshift`), chronological is reverse. No income categories exist — all 11 built-in categories are `type: 'expense'`
- **IDs** via `Date.now().toString(36) + Math.random().toString(36).slice(2, 5)` in `genId()`
- **Amounts**: stored as raw numbers, displayed with `.toFixed(2)`. Numpad: max 10 integer digits, max 2 decimal places. Zero/negative triggers shake animation
- **Assets** rendered sorted by balance descending (not by `sort` field). Default asset IDs follow `asset-*` pattern
- **Today's records** auto-refresh every 60s via `setInterval` in `book.js`
- **Tab switching** in `tabs.js`: report and assets re-render on each switch; book does not

## CSS
- All tokens via CSS custom properties in `variables.css`
- Mobile-first, max-width 500px, safe-area-inset

## SW cache
- Cache name `money-book-v3` in `sw.js:1` — bump when assets change
- PRECACHE list in `sw.js` must match actual project files

## No CI, tests, lint, typecheck, formatter, or package.json

## Communication
- AI 助手所有回复默认使用中文输出
