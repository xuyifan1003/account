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
- **Category migration**: `initState()` auto-migrates old `digital`/`communication` records → `daily` (both in-memory and via `api('PATCH')` on server)

## Data flow
- **DB**: Supabase REST via `js/db.js` (`api()`). Tables: `records`, `assets`, `asset_snapshots`
- **Read**: `initState()` → `api('GET', ...)` from Supabase
- **Cache**: localStorage key `money-book-state-v1` written on every `saveState()` / `saveSnapshot()` and after successful remote fetch
- **Write**: `saveState()` → `api('POST', ...)` upsert with `on_conflict=id`
- **Write**: adds go through `markRecordUpdated(id)` (pending queue + targeted upsert, synced even after early exit); asset balance updates go through `saveSnapshot()` + `markAssetsDirty()` (assetSync flag in pending queue — assets & snapshots re-POSTed, local values win on next init until synced)
- **Delete**: MUST go through `deleteRecordLocally(id)` (state.js) — optimistic local removal + pending queue (`money-book-pending-ops` in localStorage) + background `api('DELETE', 'records', null, 'id=eq.xxx')`. Offline deletes/edits/ADDS/asset-updates are queued and retried by `syncPendingOps()` (on init success, `online` event, `visibilitychange`, 2s self-retry while queue non-empty). `initState()` filters server records by pending deletes (防复活), prefers local versions for pending updates, auto-queues local-only records (未上传的历史新增), and when assetSync is set uses local assets & merged snapshots instead of server values
- **Edit**: click a record → same amount modal in edit mode (prefill amount, date row with `<input type="date">` capped at today, delete button). New records have no note input; legacy notes still display
- **Export**: 资产页底部"导出数据备份" → JSON download (records + assets + snapshots)
- **RLS**: permissive — `ALL` with `ANON` key

## Key conventions
- **State**: `{ records: [...], assets: [...], snapshots: [...] }`. localStorage + in-memory
- **Records** prepended (`unshift`). All 9 categories are `type: 'expense'` — no income
- **IDs**: `Date.now().toString(36) + Math.random().toString(36).slice(2, 5)`
- **Amounts**: raw numbers, display with `.toFixed(2)`. Numpad: ≤10 integer digits, ≤2 decimals
- **Assets**: sorted by balance desc at render time (`assets.js:15`)
- **Records animation**: list entrance animation only on first render (`renderRecords({animateAll:true})`); after add → `renderRecords({newId})` animates only the new item; delete/edit re-render silently (`.record-item.enter` class)
- **Tab switching**: report/assets re-render per switch; book does not (`currentTab` guard in `tabs.js`)
- **Haptic**: `haptic()` on all taps, toggles, confirms
- **Modal close animation**: overlay click / X / phone back → `sheetDown` 0.25s slide-down + `overlayOut` fade-out before `display:none`. Uses `history.pushState({modal:true})` + `popstate` listener. `closeAmountModal(instant)` skips animation (used when switching to delete confirm)
- **Record icons**: use `r.category` class for colored backgrounds (not `r.type`)
- **Touch targets**: nav-btn / modal-close visual 32px but hit area enlarged via `::after inset:-7px`

## Layout: scrolling only where needed
- **Book**: `.book-sticky` fixed top, `.book-scroll` (records list) fills rest
- **Report**: `.report-top` fixed, `.report-scroll` mid, `.report-trend-fixed` bottom (hidden in month view)

## CSS
- All tokens in `variables.css` CSS custom properties. `--primary` = `#4A4A4A`
- Mobile-first, max-width 500px, safe-area-inset

## SW cache (stale-while-revalidate, 无需 bump)
- 缓存名固定 `money-book`（`sw.js:1`），**不要带版本号、每次部署不用 bump**
- **App shell（静态资源）走 stale-while-revalidate**：命中缓存立即返回（秒开），后台静默拉新缓存供下次打开使用 → 部署后改动在**下一次启动**生效，本地验证请强制刷新
- Supabase API 请求保持 network-first（数据实时性由应用自身的两阶段渲染 + localStorage 缓存兜底）
- PRECACHE list in `sw.js` must match actual files
- `clients.claim()` on activate → new SW takes over immediately
- `icon.png` 512x512 已压缩（~160KB），不要再放大图

## Git: proxy-aware push
- Global `http.proxy = http://127.0.0.1:7890` — 代理开着时正常推，不通会报错
- 代理不通时用 `git -c http.proxy= push` 临时覆盖（不走代理），全局配置保留
- 推送前先 `git -c http.proxy= push` 不行再 `git status && git diff && git add <files> && git commit`

## No CI, tests, lint, typecheck, formatter, or package.json

## Communication
- AI 助手所有回复默认使用中文输出
