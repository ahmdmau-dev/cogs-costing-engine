# COGS Frontend — Phase 2 Design (Next.js)

**Date:** 2026-06-22
**Status:** Approved (design); pending spec review
**Scope:** A Next.js web client for the existing COGS costing backend (Phase 1). MVP = 4 screens: item catalog, recipe/BOM builder, cost-breakdown tree, price-change ripple. No new backend work.

## 1. Context & Goals

Phase 1 delivered a generic costing REST API (NestJS + PostgreSQL): items (`PURCHASED`/`PRODUCED`), recursive components, purchase prices, process costs, unit conversions, `GET /items/:id/cost` (breakdown tree), `POST /cost/preview` (ripple). Vocabulary was kept generic on purpose.

Phase 2 builds the web client the real user (an Indonesian F&B owner) will actually use. The UI speaks **Bahasa Indonesia with F&B vocabulary**; the generic API is mapped to friendly terms at the presentation layer.

**Vocabulary map (UI ⇄ API):**

| UI (Indonesian F&B) | API concept |
|---------------------|-------------|
| Produk | Item `type=PRODUCED` |
| Bahan | Item `type=PURCHASED` |
| Resep | ItemComponent list of a Produk |
| Biaya Proses | ProcessCost |
| Harga Beli | PurchasePrice |
| HPP (Harga Pokok Produksi) | computed `unitCost` |
| Konversi Unit | UnitConversion |
| Yield / Hasil | Item `yieldQuantity`/`yieldUnit` |
| Waste / Susut | ItemComponent `wasteFactor` |

## 2. Stack

- Next.js (latest stable, App Router) + TypeScript
- TanStack Query (React Query) over a thin typed `fetch` API client
- Tailwind CSS + shadcn/ui components
- IDR currency formatting (`Rp`, thousand separators) via `Intl.NumberFormat('id-ID')`
- No authentication (single user, matches backend Phase 1)
- API base URL from env (`NEXT_PUBLIC_API_BASE_URL`)

## 3. Repo Layout

Same repository, new `/web` subfolder (the NestJS backend stays at repo root). Versioned together; can be promoted to a Turborepo monorepo later if a second app/shared package appears. No backend restructure in this phase.

```
/ (repo root = NestJS backend)
  src/ ...                    # backend (unchanged)
  web/                        # Next.js app (new)
    app/
      layout.tsx              # sidebar shell
      page.tsx                # redirect → /items
      items/
        page.tsx              # catalog
        [id]/page.tsx         # item detail (tabbed)
      simulasi/page.tsx       # price-change ripple
      konversi/page.tsx       # unit conversions admin
    components/               # shared UI (sidebar, tables, cost-tree, dialogs)
    lib/
      api/                    # typed fetch client + endpoint fns
      query/                  # query keys + hooks (useItems, useCost, …)
      format.ts               # IDR + number formatting
      vocab.ts                # UI label mapping
    components/ui/            # shadcn/ui generated primitives
```

## 4. Data Layer

**API client (`lib/api`)** — one thin typed wrapper around `fetch`: base URL from env, JSON in/out, throws a typed `ApiError { status, message }` on non-2xx (surfaces the backend's 400/404 messages). One function per endpoint, mirroring Phase 1 routes:
- Items: `listItems`, `getItem`, `createItem`, `updateItem`, `deleteItem`
- Components: `listComponents(itemId)`, `addComponent(itemId, body)`, `deleteComponent(id)`
- Prices: `listPrices(itemId)`, `addPrice(itemId, body)`
- Process costs: `listProcessCosts(itemId)`, `addProcessCost(itemId, body)`, `deleteProcessCost(id)`
- Conversions: `listGlobalConversions`, `listItemConversions(itemId)`, `createConversion`, `deleteConversion`
- Costing: `getCost(itemId)`, `previewPriceChange(body)`

**TanStack Query (`lib/query`)** — query keys and hooks. Centralized invalidation so the **HPP everywhere stays correct** after any edit:

| Query key | Source |
|-----------|--------|
| `['items']` | listItems |
| `['item', id]` | getItem |
| `['components', itemId]` | listComponents |
| `['prices', itemId]` | listPrices |
| `['processCosts', itemId]` | listProcessCosts |
| `['cost', itemId]` | getCost |
| `['conversions','global']` / `['conversions', itemId]` | conversions |

Invalidation rules:
- Mutating a component / process cost / yield of a Produk → invalidate `['cost', itemId]`, `['components'/'processCosts', itemId]`, and `['items']` (list shows HPP).
- Adding a price to a Bahan → invalidate `['prices', itemId]`, `['cost', itemId]`, and **all** `['cost', *]` (a Bahan's price affects every Produk using it — broad invalidation is correct and cheap at this scale; `previewPriceChange` is used for explicit what-if, live cost is recomputed on demand by the backend).
- The ripple screen calls `previewPriceChange` directly (no cache write — it's a simulation).

Mutations show inline success/error from the typed `ApiError`; no optimistic updates in v1 (refetch-after-mutate is simpler and the API is local/fast).

## 5. Screens

### 5.1 App shell
Persistent **left sidebar** (dark): brand, nav — *Produk & Bahan* (`/items`), *Simulasi Harga* (`/simulasi`), *Konversi Unit* (`/konversi`), *Pengaturan* (later). Main content area to the right.

### 5.2 Item catalog (`/items`)
Search box + "+ Baru" button. List grouped into **PRODUK (PRODUCED)** and **BAHAN (PURCHASED)**; each row shows name, category, and a right-aligned figure — Produk: HPP/unit (from `getCost`), Bahan: latest price/base-unit. Row click → item detail. "+ Baru" opens a create dialog (nama, tipe Produk/Bahan, base unit, kategori, notes).

### 5.3 Item detail (`/items/[id]`) — tabbed
Tabs adapt to item type:
- **Info** (both): edit name/category/notes/baseUnit; for Produk also yield (quantity + unit). Delete item (confirm; backend cascades).
- **Resep** (Produk only): the **recipe builder** — see 5.4.
- **Biaya** (Produk only): Biaya Proses table — label, tipe (FIXED per batch / PER_UNIT / PERCENTAGE), value; add/delete.
- **Harga** (Bahan only): Harga Beli — add a price (price, purchaseQuantity, purchaseUnit, effectiveDate); history table (latest first); newest is the one used.
- **HPP** (Produk only): the **cost-breakdown tree** — see 5.5.

### 5.4 Recipe builder (Resep tab) — single scroll page
Chosen layout: one scrolling page, top-to-bottom — Produk info (yield), **Bahan table** (component item picker, qty, unit, waste% — inline "+ tambah bahan" row), **Biaya Proses table** ("+ tambah biaya"). A **sticky HPP bar** pinned to the bottom shows current HPP/unit, refetched (`['cost', itemId]`) after each add/edit/delete. Component item picker is a searchable select over existing items (can pick PURCHASED or PRODUCED — enables semi-finished goods). Backend rejects cycles / non-PRODUCED parents / bad numbers; those 400s surface as inline errors.

### 5.5 Cost-breakdown tree (HPP tab)
Chosen layout: **nested expandable tree**. Header shows total batch cost + HPP/unit. Rows render the `CostNode` tree from `getCost`: each PRODUCED node expandable to its components; leaf shows qty (and waste→gross when `wasteFactor<1`), per-unit cost, line cost. A **Biaya Proses** group lists FIXED/PER_UNIT/PERCENTAGE lines. A materials-vs-process **proportion bar** at the bottom (Bahan % vs Proses %). Everything visible inline (no side panel).

### 5.6 Price-change ripple (`/simulasi`)
Pick a Bahan (searchable select) → shows current latest price → input a new price (price, purchaseQuantity, purchaseUnit) → "Hitung Dampak" calls `previewPriceChange`. Result table of affected Produk: nama, HPP lama, HPP baru, Δ (absolute + %), sorted by **largest % impact descending**. Banner clarifies it's a simulation; a per-row/secondary "Simpan harga ini" action persists the new price via `addPrice` (then invalidates costs). Empty result → "Tidak ada produk yang memakai bahan ini."

### 5.7 Unit conversions (`/konversi`)
Simple admin: global conversions table (fromUnit, toUnit, factor) with create/delete; per-item conversions managed from the item detail (Info tab, small section). Lets the user set up kg↔g, L↔ml, and per-item (1 ekor = 1000 g).

## 6. Cross-cutting

- **Formatting** (`lib/format.ts`): IDR via `Intl.NumberFormat('id-ID', { style:'currency', currency:'IDR', maximumFractionDigits:2 })`; plain numbers with `id-ID` grouping. The API returns numbers already rounded (unitCost 4dp, money 2dp); the UI only formats, never re-computes cost.
- **Loading / error**: every query renders skeleton/spinner while loading and a readable error (from `ApiError.message`) on failure; mutations disable the submit button while pending and show field/inline errors. A small toast on success.
- **Empty states**: friendly Indonesian copy for no-items, no-components, no-prices, no-ripple-results.
- **Vocabulary** lives in one `lib/vocab.ts` map so the F&B labels are centralized (and a future locale/category swap is a single file).

## 7. Components (units, isolated)

`Sidebar`, `ItemList` (grouped), `ItemFormDialog`, `ComponentTable` + `ComponentRowForm`, `ProcessCostTable`, `PriceForm` + `PriceHistoryTable`, `CostTree` (recursive node renderer) + `ProportionBar`, `RipplePanel` + `RippleResultTable`, `ConversionTable`. Each consumes a query/mutation hook and typed props; the recursive `CostTree` is the one non-trivial unit (renders `CostNode` recursively, manages per-node expand state).

## 8. Testing

- Component/unit tests (Vitest + React Testing Library) for the pure/logic-heavy pieces: `CostTree` rendering a known `CostNode` fixture (correct nesting, gross-qty display when waste<1, proportion bar math), `format.ts` (IDR/number formatting), `vocab.ts` mapping, and the ripple result sorting/Δ computation.
- API client tested against mocked `fetch` (maps non-2xx → `ApiError`).
- No full e2e in this phase (manual smoke against the running backend, like Phase 1). Optional Playwright deferred.

## 9. Out of Scope (Phase 2)

Auth, multi-user, deployment/hosting, pricing/markup & selling price, sales/inventory, reports/exports, optimistic updates, offline, mobile-native, i18n beyond the single Indonesian vocabulary file, historical as-of cost views.
