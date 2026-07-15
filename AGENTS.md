# AGENTS.md — 极简记账

## What this is
Vanilla JS PWA (no build, no npm, no backend). Single-page personal finance tracker in Chinese. Data persists to Supabase (PostgreSQL).

## Run
```
npx serve .
```

## Init flow (js/app.js)
```
DOMContentLoaded → initTabs → initBook → initAssets → initReport
  → if offline: render empty + toast, skip SW
  → if online: initState() (sync load cache + return remote promise)
               → first render (cached data)
               → await remotePromise → second render (fresh data)
               → SW register
```
- `initState()` is **sync** — loads localStorage cache instantly, returns a promise for remote fetch
- Two-phase render eliminates blank-screen wait

## Data flow
- **DB**: Supabase REST via `js/db.js` (`api()`). Tables: `records`, `assets`, `asset_snapshots`
- **Read**: `initState()` → `api('GET', ...)` from Supabase
- **Cache**: localStorage key `money-book-state-v1` written on every `saveState()` / `saveSnapshot()` and after successful remote fetch
- **Write**: `saveState()` → `api('POST', ...)` upsert with `on_conflict=id`
- **Delete**: MUST call `api('DELETE', 'records', null, 'id=eq.xxx')` — upsert won't remove rows
- **RLS**: permissive — `ALL` with `ANON` key

## Key conventions
- **State**: `{ records: [...], assets: [...], snapshots: [...] }`. localStorage + in-memory
- **Records** prepended (`unshift`). All 11 categories are `type: 'expense'` — no income
- **IDs**: `Date.now().toString(36) + Math.random().toString(36).slice(2, 5)`
- **Amounts**: raw numbers, display with `.toFixed(2)`. Numpad: ≤10 integer digits, ≤2 decimals
- **Assets**: sorted by balance desc at render time (`assets.js:15`)
- **Today's records**: auto-refresh every 60s via `setInterval` in `book.js`
- **Tab switching**: report/assets re-render per switch; book does not (`currentTab` guard in `tabs.js`)
- **Haptic**: `haptic()` on all taps, toggles, confirms
- **Modal close animation**: overlay click / X / phone back → `sheetDown` 0.25s slide-down + `overlayOut` fade-out before `display:none`. Uses `history.pushState({modal:true})` + `popstate` listener
- **Record icons**: use `r.category` class for colored backgrounds (not `r.type`)

## Layout: scrolling only where needed
- **Book**: `.book-sticky` fixed top, `.book-scroll` (records list) fills rest
- **Report**: `.report-top` fixed, `.report-scroll` mid, `.report-trend-fixed` bottom (hidden in month view)

## CSS
- All tokens in `variables.css` CSS custom properties. `--primary` = `#4A4A4A`
- Mobile-first, max-width 500px, safe-area-inset

## SW cache (network-first)
- Cache name in `sw.js:1` — **每次部署必须 bump**（如 `v20` → `v21`）
- PRECACHE list in `sw.js` must match actual files
- `clients.claim()` on activate → new SW takes over immediately

## Git: proxy-aware push
- Global `http.proxy = http://127.0.0.1:7890` — 代理开着时正常推，不通会报错
- 代理不通时用 `git -c http.proxy= push` 临时覆盖（不走代理），全局配置保留
- 推送前先 `git -c http.proxy= push` 不行再 `git status && git diff && git add <files> && git commit`

## No CI, tests, lint, typecheck, formatter, or package.json

## Communication
- AI 助手所有回复默认使用中文输出
