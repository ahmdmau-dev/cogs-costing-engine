# COGS Frontend (Phase 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Next.js web client (in `/web`) for the existing COGS costing API: item catalog, recipe/BOM builder, cost-breakdown tree, and price-change ripple — in Bahasa Indonesia F&B vocabulary.

**Architecture:** Next.js App Router + TypeScript. A thin typed `fetch` client wraps the Phase 1 REST API and throws `ApiError`; TanStack Query owns server state with centralized query keys + invalidation so HPP stays correct everywhere. Tailwind + shadcn/ui for UI. Pure logic (currency format, ripple sort, recursive cost-tree render) is unit-tested with Vitest; pages compose tested hooks/components.

**Tech Stack:** Next.js (App Router), TypeScript, TanStack Query, Tailwind CSS, shadcn/ui, Vitest + React Testing Library, `Intl.NumberFormat('id-ID')`.

**Backend reference (Phase 1, unchanged):** base URL `NEXT_PUBLIC_API_BASE_URL` (dev: `http://localhost:3000`). Routes: `GET/POST/PATCH/DELETE /items`, `GET/POST /items/:id/components`, `DELETE /components/:id`, `GET/POST /items/:id/prices`, `GET/POST /items/:id/process-costs`, `DELETE /process-costs/:id`, `GET/POST /unit-conversions`, `GET /items/:id/conversions`, `DELETE /unit-conversions/:id`, `GET /items/:id/cost`, `POST /cost/preview`. All numeric/money fields are JSON strings on write; cost endpoints return numbers.

> **REPO LAYOUT (updated 2026-06-22):** the frontend is a **STANDALONE repository** at `/Users/ictkapalapiglobal/Sites/cogs-web` (separate from the backend repo). Throughout this plan, paths written as `web/X` mean **the frontend repo root** — drop the `web/` prefix when creating files (e.g. `web/lib/format.ts` → `<cogs-web>/lib/format.ts`, `web/app/page.tsx` → `<cogs-web>/app/page.tsx`). Task 1 scaffolds the Next.js app directly at the repo root (create-next-app initializes its own git repo). All `cd web` commands mean "from the frontend repo root".

---

## File Structure

```
cogs-web/   (= the "web/" prefix used in tasks below)
  package.json, tsconfig.json, next.config.ts, postcss.config.mjs, .env.local, .env.example
  vitest.config.ts, vitest.setup.ts
  tailwind.config.ts, app/globals.css
  app/
    layout.tsx                  # html + providers + sidebar shell
    providers.tsx               # QueryClientProvider
    page.tsx                    # redirect → /items
    items/page.tsx              # catalog
    items/[id]/page.tsx         # item detail (tabs)
    simulasi/page.tsx           # ripple
    konversi/page.tsx           # unit conversions
  components/
    sidebar.tsx
    item-list.tsx, item-form-dialog.tsx
    component-table.tsx, process-cost-table.tsx
    price-form.tsx, price-history-table.tsx
    cost-tree.tsx, proportion-bar.tsx
    ripple-panel.tsx
    conversion-table.tsx
    ui/                         # shadcn/ui primitives (generated)
  lib/
    api/types.ts                # API DTO/response types
    api/client.ts               # fetch wrapper + ApiError + endpoint fns
    query/keys.ts               # query key factory
    query/hooks.ts              # useItems, useItem, useCost, mutations, …
    format.ts                   # IDR + number formatting
    vocab.ts                    # Indonesian F&B labels
    ripple.ts                   # sortRippleRows (pure)
  test/
    format.test.ts, vocab.test.ts, ripple.test.ts
    api-client.test.ts
    cost-tree.test.tsx
```

---

## Task 1: Scaffold standalone Next.js repo (cogs-web)

**Files:** Create the `cogs-web` repo via create-next-app, then `.env.local`, `.env.example` at its root.

- [ ] **Step 1: Scaffold**

Run from `/Users/ictkapalapiglobal/Sites`:
```bash
npx --yes create-next-app@latest cogs-web --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*" --no-turbopack --use-npm
```
This creates `/Users/ictkapalapiglobal/Sites/cogs-web` with App Router, Tailwind, `@/*` alias, and its OWN initialized git repo (create-next-app runs `git init` + an initial commit). All subsequent tasks operate inside this repo root (the plan's `web/` prefix = this root).

- [ ] **Step 2: Write `web/.env.example` and `web/.env.local`**

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```
Write the same line to both files.

- [ ] **Step 3: Confirm `.gitignore` covers web**

The repo root `.gitignore` already ignores `node_modules`. Append to `web/.gitignore` (created by create-next-app) is unnecessary — verify it ignores `.next` and `.env*.local`. Run: `grep -E '.next|.env' web/.gitignore`. Expected: both present.

- [ ] **Step 4: Verify dev build**

Run: `cd web && npm run build`
Expected: build succeeds (default starter page).

- [ ] **Step 5: Commit**

```bash
git add web .gitignore
git commit -m "feat(web): scaffold Next.js app"
```

---

## Task 2: Tooling — Vitest + shadcn/ui

**Files:** Create `web/vitest.config.ts`, `web/vitest.setup.ts`; init shadcn; modify `web/package.json` scripts.

- [ ] **Step 1: Install test + UI deps**

```bash
cd web
npm i @tanstack/react-query
npm i -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

- [ ] **Step 2: Write `web/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'jsdom', globals: true, setupFiles: ['./vitest.setup.ts'] },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});
```

- [ ] **Step 3: Write `web/vitest.setup.ts`**

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 4: Add scripts to `web/package.json`** (merge into `"scripts"`)

```json
{ "scripts": { "test": "vitest run", "test:watch": "vitest" } }
```

- [ ] **Step 5: Init shadcn/ui**

```bash
npx shadcn@latest init -d
npx shadcn@latest add button input dialog table tabs select card badge sonner skeleton
```
(`-d` accepts defaults. This generates `components/ui/*` and a `cn` util at `lib/utils.ts`.)

- [ ] **Step 6: Smoke test the test runner**

Create `web/test/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
describe('smoke', () => { it('runs', () => { expect(1 + 1).toBe(2); }); });
```
Run: `npm test`
Expected: 1 passing test. Then delete `web/test/smoke.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add web
git commit -m "chore(web): add vitest and shadcn/ui"
```

---

## Task 3: Formatting + vocabulary utilities

**Files:** Create `web/lib/format.ts`, `web/lib/vocab.ts`; Test `web/test/format.test.ts`, `web/test/vocab.test.ts`.

- [ ] **Step 1: Write failing tests `web/test/format.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { formatIDR, formatNumber } from '@/lib/format';

describe('format', () => {
  it('formats IDR with Rp and thousand separators', () => {
    expect(formatIDR(2450)).toBe('Rp 2.450');
    expect(formatIDR(12)).toBe('Rp 12');
  });
  it('keeps up to 2 decimals for fractional money', () => {
    expect(formatIDR(7.2)).toBe('Rp 7,2');
  });
  it('formats plain numbers with id-ID grouping', () => {
    expect(formatNumber(1000)).toBe('1.000');
    expect(formatNumber(187.5)).toBe('187,5');
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd web && npx vitest run test/format.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `web/lib/format.ts`**

```ts
const idr = new Intl.NumberFormat('id-ID', {
  style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 2,
});
const num = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 });

// Intl renders IDR as "Rp 2.450" in id-ID locale (non-breaking space). Normalize to a regular space.
export const formatIDR = (v: number): string => idr.format(v).replace(/ /g, ' ');
export const formatNumber = (v: number): string => num.format(v);
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run test/format.test.ts`
Expected: PASS. (If the locale renders without a space, adjust the test expectation to match `idr.format` output exactly — but `id-ID` uses `Rp ` which the replace turns into `Rp `.)

- [ ] **Step 5: Write failing test `web/test/vocab.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { itemTypeLabel, costTypeLabel, t } from '@/lib/vocab';

describe('vocab', () => {
  it('maps item types to Indonesian F&B labels', () => {
    expect(itemTypeLabel('PRODUCED')).toBe('Produk');
    expect(itemTypeLabel('PURCHASED')).toBe('Bahan');
  });
  it('maps cost types', () => {
    expect(costTypeLabel('FIXED')).toBe('Tetap / batch');
    expect(costTypeLabel('PER_UNIT')).toBe('Per unit');
    expect(costTypeLabel('PERCENTAGE')).toBe('Persentase');
  });
  it('exposes shared labels via t', () => {
    expect(t.recipe).toBe('Resep');
    expect(t.cost).toBe('HPP');
  });
});
```

- [ ] **Step 6: Run, verify fail**

Run: `npx vitest run test/vocab.test.ts`
Expected: FAIL.

- [ ] **Step 7: Implement `web/lib/vocab.ts`**

```ts
import type { ItemType, CostType } from '@/lib/api/types';

export const itemTypeLabel = (t: ItemType): string => (t === 'PRODUCED' ? 'Produk' : 'Bahan');

export const costTypeLabel = (c: CostType): string =>
  c === 'FIXED' ? 'Tetap / batch' : c === 'PER_UNIT' ? 'Per unit' : 'Persentase';

export const t = {
  products: 'Produk', materials: 'Bahan', catalog: 'Produk & Bahan',
  recipe: 'Resep', processCosts: 'Biaya Proses', price: 'Harga Beli',
  cost: 'HPP', conversions: 'Konversi Unit', simulation: 'Simulasi Harga',
  yield: 'Hasil (Yield)', waste: 'Susut (Waste)', add: 'Tambah', new: 'Baru',
  unit: 'Satuan', quantity: 'Jumlah', name: 'Nama', category: 'Kategori', notes: 'Catatan',
} as const;
```

Note: `web/lib/api/types.ts` is created in Task 4. This file imports types only; if implementing strictly in order, create the `ItemType`/`CostType` type aliases here temporarily is NOT needed — Task 4 precedes consumption. To keep Task 3 self-contained for the test, define the test without importing types (the test above does not need `api/types`). The `import type` is erased at runtime, so the vocab test passes even before Task 4 compiles app code; run the vocab test in isolation. If TS complains in the editor, proceed — Task 4 adds the module.

- [ ] **Step 8: Run, verify pass; commit**

Run: `npx vitest run test/format.test.ts test/vocab.test.ts`
Expected: PASS.
```bash
git add web/lib/format.ts web/lib/vocab.ts web/test/format.test.ts web/test/vocab.test.ts
git commit -m "feat(web): IDR formatting and F&B vocabulary"
```

---

## Task 4: API types + typed fetch client

**Files:** Create `web/lib/api/types.ts`, `web/lib/api/client.ts`; Test `web/test/api-client.test.ts`.

- [ ] **Step 1: Write `web/lib/api/types.ts`**

```ts
export type ItemType = 'PURCHASED' | 'PRODUCED';
export type CostType = 'FIXED' | 'PER_UNIT' | 'PERCENTAGE';

export interface Item {
  id: string; name: string; type: ItemType; baseUnit: string;
  category: string | null; notes: string | null;
  yieldQuantity: string | null; yieldUnit: string | null;
  createdAt: string; updatedAt: string;
}
export interface ItemComponent {
  id: string; parentItemId: string; componentItemId: string;
  quantity: string; unit: string; wasteFactor: string; createdAt: string;
}
export interface PurchasePrice {
  id: string; itemId: string; price: string; purchaseQuantity: string;
  purchaseUnit: string; effectiveDate: string; createdAt: string;
}
export interface ProcessCost { id: string; itemId: string; label: string; costType: CostType; value: string; }
export interface UnitConversion { id: string; itemId: string | null; fromUnit: string; toUnit: string; factor: string; }

export interface ProcessLine { label: string; costType: CostType; value: number; amount: number; }
export interface CostBreakdown {
  materialCost: number;
  process: { fixedTotal: number; perUnitTotal: number; pctTotal: number; lines: ProcessLine[] };
  yieldQuantity: number; yieldUnit: string | null; totalBatchCost: number; components: CostNode[];
}
export interface CostNode {
  itemId: string; name: string; type: ItemType; baseUnit: string; unitCost: number;
  quantity?: number; unit?: string; grossQuantity?: number; lineCost?: number; breakdown?: CostBreakdown;
}
export interface RippleRow { itemId: string; name: string; oldUnitCost: number; newUnitCost: number; delta: number; }

// write payloads
export interface CreateItemBody { name: string; type: ItemType; baseUnit: string; category?: string; notes?: string; yieldQuantity?: string; yieldUnit?: string; }
export type UpdateItemBody = Partial<CreateItemBody>;
export interface CreateComponentBody { componentItemId: string; quantity: string; unit: string; wasteFactor?: string; }
export interface CreatePriceBody { price: string; purchaseQuantity: string; purchaseUnit: string; effectiveDate: string; }
export interface CreateProcessCostBody { label: string; costType: CostType; value: string; }
export interface CreateConversionBody { itemId?: string; fromUnit: string; toUnit: string; factor: string; }
export interface PreviewBody { itemId: string; price: string; purchaseQuantity: string; purchaseUnit: string; }
```

- [ ] **Step 2: Write failing test `web/test/api-client.test.ts`**

```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ApiError, apiFetch } from '@/lib/api/client';

afterEach(() => vi.restoreAllMocks());

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(body), {
    status, headers: { 'content-type': 'application/json' },
  })));
}

describe('apiFetch', () => {
  it('returns parsed JSON on 2xx', async () => {
    mockFetch(200, { id: 'x', name: 'Tepung' });
    const data = await apiFetch<{ id: string; name: string }>('/items/x');
    expect(data.name).toBe('Tepung');
  });
  it('throws ApiError with backend message on non-2xx', async () => {
    mockFetch(400, { statusCode: 400, message: 'Prices can only be added to PURCHASED items' });
    await expect(apiFetch('/items/x/prices', { method: 'POST', body: {} }))
      .rejects.toMatchObject({ status: 400, message: 'Prices can only be added to PURCHASED items' });
  });
  it('joins array validation messages', async () => {
    mockFetch(400, { statusCode: 400, message: ['quantity must be a number string > 0', 'unit should not be empty'] });
    await expect(apiFetch('/items/x/components', { method: 'POST', body: {} }))
      .rejects.toMatchObject({ status: 400, message: 'quantity must be a number string > 0, unit should not be empty' });
  });
});
```

- [ ] **Step 3: Run, verify fail**

Run: `cd web && npx vitest run test/api-client.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement `web/lib/api/client.ts`**

```ts
import type {
  Item, ItemComponent, PurchasePrice, ProcessCost, UnitConversion, CostNode, RippleRow,
  CreateItemBody, UpdateItemBody, CreateComponentBody, CreatePriceBody, CreateProcessCostBody,
  CreateConversionBody, PreviewBody,
} from './types';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.name = 'ApiError'; this.status = status; }
}

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

export async function apiFetch<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers: opts.body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: 'no-store',
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const m = data?.message;
    throw new ApiError(res.status, Array.isArray(m) ? m.join(', ') : (m ?? `Request failed (${res.status})`));
  }
  return data as T;
}

// Endpoint functions
export const api = {
  listItems: () => apiFetch<Item[]>('/items'),
  getItem: (id: string) => apiFetch<Item>(`/items/${id}`),
  createItem: (body: CreateItemBody) => apiFetch<Item>('/items', { method: 'POST', body }),
  updateItem: (id: string, body: UpdateItemBody) => apiFetch<Item>(`/items/${id}`, { method: 'PATCH', body }),
  deleteItem: (id: string) => apiFetch<{ deleted: boolean }>(`/items/${id}`, { method: 'DELETE' }),

  listComponents: (itemId: string) => apiFetch<ItemComponent[]>(`/items/${itemId}/components`),
  addComponent: (itemId: string, body: CreateComponentBody) => apiFetch<ItemComponent>(`/items/${itemId}/components`, { method: 'POST', body }),
  deleteComponent: (id: string) => apiFetch<{ deleted: boolean }>(`/components/${id}`, { method: 'DELETE' }),

  listPrices: (itemId: string) => apiFetch<PurchasePrice[]>(`/items/${itemId}/prices`),
  addPrice: (itemId: string, body: CreatePriceBody) => apiFetch<PurchasePrice>(`/items/${itemId}/prices`, { method: 'POST', body }),

  listProcessCosts: (itemId: string) => apiFetch<ProcessCost[]>(`/items/${itemId}/process-costs`),
  addProcessCost: (itemId: string, body: CreateProcessCostBody) => apiFetch<ProcessCost>(`/items/${itemId}/process-costs`, { method: 'POST', body }),
  deleteProcessCost: (id: string) => apiFetch<{ deleted: boolean }>(`/process-costs/${id}`, { method: 'DELETE' }),

  listGlobalConversions: () => apiFetch<UnitConversion[]>('/unit-conversions'),
  listItemConversions: (itemId: string) => apiFetch<UnitConversion[]>(`/items/${itemId}/conversions`),
  createConversion: (body: CreateConversionBody) => apiFetch<UnitConversion>('/unit-conversions', { method: 'POST', body }),
  deleteConversion: (id: string) => apiFetch<{ deleted: boolean }>(`/unit-conversions/${id}`, { method: 'DELETE' }),

  getCost: (itemId: string) => apiFetch<CostNode>(`/items/${itemId}/cost`),
  previewPriceChange: (body: PreviewBody) => apiFetch<RippleRow[]>('/cost/preview', { method: 'POST', body }),
};
```

- [ ] **Step 5: Run, verify pass; commit**

Run: `npx vitest run test/api-client.test.ts`
Expected: PASS (3/3).
```bash
git add web/lib/api web/test/api-client.test.ts
git commit -m "feat(web): typed API client with ApiError"
```

---

## Task 5: TanStack Query provider, keys, hooks

**Files:** Create `web/app/providers.tsx`, `web/lib/query/keys.ts`, `web/lib/query/hooks.ts`; Modify `web/app/layout.tsx`.

- [ ] **Step 1: Write `web/lib/query/keys.ts`**

```ts
export const qk = {
  items: ['items'] as const,
  item: (id: string) => ['item', id] as const,
  components: (id: string) => ['components', id] as const,
  prices: (id: string) => ['prices', id] as const,
  processCosts: (id: string) => ['processCosts', id] as const,
  cost: (id: string) => ['cost', id] as const,
  conversionsGlobal: ['conversions', 'global'] as const,
  conversionsItem: (id: string) => ['conversions', id] as const,
};
```

- [ ] **Step 2: Write `web/app/providers.tsx`**

```tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: { queries: { staleTime: 5_000, retry: 1 } },
  }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 3: Write `web/lib/query/hooks.ts`**

```ts
'use client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import { qk } from './keys';
import type {
  CreateItemBody, UpdateItemBody, CreateComponentBody, CreatePriceBody,
  CreateProcessCostBody, CreateConversionBody,
} from '@/lib/api/types';

export const useItems = () => useQuery({ queryKey: qk.items, queryFn: api.listItems });
export const useItem = (id: string) => useQuery({ queryKey: qk.item(id), queryFn: () => api.getItem(id) });
export const useComponents = (id: string) => useQuery({ queryKey: qk.components(id), queryFn: () => api.listComponents(id) });
export const usePrices = (id: string) => useQuery({ queryKey: qk.prices(id), queryFn: () => api.listPrices(id) });
export const useProcessCosts = (id: string) => useQuery({ queryKey: qk.processCosts(id), queryFn: () => api.listProcessCosts(id) });
export const useCost = (id: string, enabled = true) =>
  useQuery({ queryKey: qk.cost(id), queryFn: () => api.getCost(id), enabled });
export const useGlobalConversions = () => useQuery({ queryKey: qk.conversionsGlobal, queryFn: api.listGlobalConversions });

export function useCreateItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateItemBody) => api.createItem(body),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.items }),
  });
}
export function useUpdateItem(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateItemBody) => api.updateItem(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk.item(id) }); qc.invalidateQueries({ queryKey: qk.items }); qc.invalidateQueries({ queryKey: qk.cost(id) }); },
  });
}
export function useDeleteItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteItem(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.items }),
  });
}

// invalidate the produced item's cost + the catalog (which shows HPP)
function invalidateCostFamily(qc: ReturnType<typeof useQueryClient>, itemId: string) {
  qc.invalidateQueries({ queryKey: qk.cost(itemId) });
  qc.invalidateQueries({ queryKey: qk.items });
}

export function useAddComponent(itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateComponentBody) => api.addComponent(itemId, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk.components(itemId) }); invalidateCostFamily(qc, itemId); },
  });
}
export function useDeleteComponent(itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteComponent(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk.components(itemId) }); invalidateCostFamily(qc, itemId); },
  });
}
export function useAddProcessCost(itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateProcessCostBody) => api.addProcessCost(itemId, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk.processCosts(itemId) }); invalidateCostFamily(qc, itemId); },
  });
}
export function useDeleteProcessCost(itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteProcessCost(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk.processCosts(itemId) }); invalidateCostFamily(qc, itemId); },
  });
}
export function useAddPrice(itemId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePriceBody) => api.addPrice(itemId, body),
    // a Bahan price affects every Produk using it → invalidate all cost queries + catalog
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk.prices(itemId) }); qc.invalidateQueries({ queryKey: ['cost'] }); qc.invalidateQueries({ queryKey: qk.items }); },
  });
}
export function useCreateConversion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateConversionBody) => api.createConversion(body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk.conversionsGlobal }); qc.invalidateQueries({ queryKey: ['cost'] }); },
  });
}
export function useDeleteConversion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.deleteConversion(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: qk.conversionsGlobal }); qc.invalidateQueries({ queryKey: ['cost'] }); },
  });
}
```

- [ ] **Step 4: Wire providers into `web/app/layout.tsx`**

Replace the body wrapper so children are inside `<Providers>` and `<Sonner />` (toast) is mounted. (Sidebar added in Task 6.) Minimal version now:
```tsx
import type { Metadata } from 'next';
import './globals.css';
import { Providers } from './providers';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = { title: 'COGS', description: 'Kalkulator HPP' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Verify build**

Run: `cd web && npm run build`
Expected: build succeeds.

- [ ] **Step 6: Commit**

```bash
git add web/app web/lib/query
git commit -m "feat(web): query client, keys, and data hooks"
```

---

## Task 6: App shell (sidebar) + root redirect

**Files:** Create `web/components/sidebar.tsx`, `web/app/page.tsx`; Modify `web/app/layout.tsx`.

- [ ] **Step 1: Write `web/components/sidebar.tsx`**

```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { t } from '@/lib/vocab';

const nav = [
  { href: '/items', label: t.catalog },
  { href: '/simulasi', label: t.simulation },
  { href: '/konversi', label: t.conversions },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="w-56 shrink-0 bg-slate-900 text-slate-300 min-h-screen p-4">
      <div className="text-white font-bold text-lg mb-6">COGS</div>
      <nav className="flex flex-col gap-1">
        {nav.map((n) => {
          const active = path === n.href || path.startsWith(n.href + '/');
          return (
            <Link key={n.href} href={n.href}
              className={`rounded px-3 py-2 text-sm ${active ? 'bg-slate-700 text-white' : 'hover:bg-slate-800'}`}>
              {n.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Put the sidebar in the layout** — update `web/app/layout.tsx` body:

```tsx
      <body>
        <Providers>
          <div className="flex">
            <Sidebar />
            <main className="flex-1 p-6 max-w-5xl">{children}</main>
          </div>
        </Providers>
        <Toaster />
      </body>
```
(Add `import { Sidebar } from '@/components/sidebar';` at the top.)

- [ ] **Step 3: Write `web/app/page.tsx`** (redirect to catalog)

```tsx
import { redirect } from 'next/navigation';
export default function Home() { redirect('/items'); }
```

- [ ] **Step 4: Verify build + manual**

Run: `cd web && npm run build`
Expected: succeeds. (Visual check happens in Task 12 smoke.)

- [ ] **Step 5: Commit**

```bash
git add web
git commit -m "feat(web): sidebar shell and root redirect"
```

---

## Task 7: Item catalog page

**Files:** Create `web/components/item-list.tsx`, `web/components/item-form-dialog.tsx`, `web/app/items/page.tsx`.

- [ ] **Step 1: Write `web/components/item-form-dialog.tsx`** (create item)

```tsx
'use client';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCreateItem } from '@/lib/query/hooks';
import { ApiError } from '@/lib/api/client';
import { t, itemTypeLabel } from '@/lib/vocab';
import type { ItemType } from '@/lib/api/types';
import { toast } from 'sonner';

export function ItemFormDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(''); const [type, setType] = useState<ItemType>('PURCHASED');
  const [baseUnit, setBaseUnit] = useState(''); const [category, setCategory] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const create = useCreateItem();

  async function submit() {
    setErr(null);
    try {
      await create.mutateAsync({ name, type, baseUnit, category: category || undefined });
      toast.success('Item dibuat'); setOpen(false); setName(''); setBaseUnit(''); setCategory('');
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Gagal menyimpan'); }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button>+ {t.new}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t.new} {t.catalog}</DialogTitle></DialogHeader>
        <div className="flex flex-col gap-3">
          <Input placeholder={t.name} value={name} onChange={(e) => setName(e.target.value)} />
          <Select value={type} onValueChange={(v) => setType(v as ItemType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="PURCHASED">{itemTypeLabel('PURCHASED')}</SelectItem>
              <SelectItem value="PRODUCED">{itemTypeLabel('PRODUCED')}</SelectItem>
            </SelectContent>
          </Select>
          <Input placeholder={`${t.unit} dasar (mis. g, pcs)`} value={baseUnit} onChange={(e) => setBaseUnit(e.target.value)} />
          <Input placeholder={t.category} value={category} onChange={(e) => setCategory(e.target.value)} />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <Button onClick={submit} disabled={create.isPending}>{create.isPending ? 'Menyimpan…' : 'Simpan'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Write `web/components/item-list.tsx`**

```tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useItems } from '@/lib/query/hooks';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { t } from '@/lib/vocab';
import type { Item } from '@/lib/api/types';

function Group({ title, items }: { title: string; items: Item[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-6">
      <div className="text-xs uppercase text-slate-500 mb-2">{title}</div>
      <div className="divide-y border rounded">
        {items.map((it) => (
          <Link key={it.id} href={`/items/${it.id}`} className="flex justify-between px-3 py-2 hover:bg-slate-50">
            <span>{it.name}{it.category ? <span className="text-slate-400"> · {it.category}</span> : null}</span>
            <span className="text-slate-500">{it.baseUnit}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function ItemList() {
  const { data, isLoading, error } = useItems();
  const [q, setQ] = useState('');
  if (isLoading) return <div className="space-y-2"><Skeleton className="h-8 w-full" /><Skeleton className="h-8 w-full" /></div>;
  if (error) return <p className="text-red-600">Gagal memuat: {(error as Error).message}</p>;
  const items = (data ?? []).filter((i) => i.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <Input placeholder="Cari…" value={q} onChange={(e) => setQ(e.target.value)} className="mb-4 max-w-sm" />
      <Group title={t.products} items={items.filter((i) => i.type === 'PRODUCED')} />
      <Group title={t.materials} items={items.filter((i) => i.type === 'PURCHASED')} />
      {items.length === 0 && <p className="text-slate-500">Belum ada item.</p>}
    </div>
  );
}
```

- [ ] **Step 3: Write `web/app/items/page.tsx`**

```tsx
import { ItemList } from '@/components/item-list';
import { ItemFormDialog } from '@/components/item-form-dialog';
import { t } from '@/lib/vocab';

export default function ItemsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold">{t.catalog}</h1>
        <ItemFormDialog />
      </div>
      <ItemList />
    </div>
  );
}
```

- [ ] **Step 4: Verify build**

Run: `cd web && npm run build`
Expected: succeeds.

- [ ] **Step 5: Commit**

```bash
git add web
git commit -m "feat(web): item catalog with create dialog"
```

---

## Task 8: Item detail shell (tabs) + Info tab

**Files:** Create `web/app/items/[id]/page.tsx`.

- [ ] **Step 1: Write `web/app/items/[id]/page.tsx`**

```tsx
'use client';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useItem, useUpdateItem, useDeleteItem } from '@/lib/query/hooks';
import { ComponentTable } from '@/components/component-table';
import { ProcessCostTable } from '@/components/process-cost-table';
import { PriceForm } from '@/components/price-form';
import { CostTree } from '@/components/cost-tree';
import { t } from '@/lib/vocab';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';

export default function ItemDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { data: item, isLoading } = useItem(id);
  const update = useUpdateItem(id);
  const del = useDeleteItem();
  const [name, setName] = useState(''); const [yieldQ, setYieldQ] = useState(''); const [yieldU, setYieldU] = useState('');
  useEffect(() => { if (item) { setName(item.name); setYieldQ(item.yieldQuantity ?? ''); setYieldU(item.yieldUnit ?? ''); } }, [item]);

  if (isLoading || !item) return <Skeleton className="h-40 w-full" />;
  const isProduced = item.type === 'PRODUCED';

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">{item.name}</h1>
      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Info</TabsTrigger>
          {isProduced && <TabsTrigger value="resep">{t.recipe}</TabsTrigger>}
          {isProduced && <TabsTrigger value="biaya">{t.processCosts}</TabsTrigger>}
          {!isProduced && <TabsTrigger value="harga">{t.price}</TabsTrigger>}
          {isProduced && <TabsTrigger value="hpp">{t.cost}</TabsTrigger>}
        </TabsList>

        <TabsContent value="info" className="space-y-3 max-w-md mt-4">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t.name} />
          {isProduced && (
            <div className="flex gap-2">
              <Input value={yieldQ} onChange={(e) => setYieldQ(e.target.value)} placeholder={`${t.yield} qty`} />
              <Input value={yieldU} onChange={(e) => setYieldU(e.target.value)} placeholder={`${t.yield} unit`} />
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={async () => { await update.mutateAsync({ name, yieldQuantity: yieldQ || undefined, yieldUnit: yieldU || undefined }); toast.success('Tersimpan'); }} disabled={update.isPending}>Simpan</Button>
            <Button variant="destructive" onClick={async () => { if (confirm('Hapus item ini?')) { await del.mutateAsync(id); router.push('/items'); } }}>Hapus</Button>
          </div>
        </TabsContent>

        {isProduced && <TabsContent value="resep" className="mt-4"><ComponentTable itemId={id} baseUnitHint={item.baseUnit} /></TabsContent>}
        {isProduced && <TabsContent value="biaya" className="mt-4"><ProcessCostTable itemId={id} /></TabsContent>}
        {!isProduced && <TabsContent value="harga" className="mt-4"><PriceForm itemId={id} /></TabsContent>}
        {isProduced && <TabsContent value="hpp" className="mt-4"><CostTree itemId={id} /></TabsContent>}
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 2: Verify build fails on missing components**

Run: `cd web && npm run build`
Expected: FAIL — `ComponentTable`/`ProcessCostTable`/`PriceForm`/`CostTree` not found. These are built in Tasks 9–12. **Do not commit until Task 12.** (Implementer note: this task's file compiles only after Tasks 9–12 add the imports. Build/commit happens at the end of Task 12. If you prefer green-between-tasks, temporarily stub the four imports with `() => null` placeholders and remove them as each real component lands.)

To keep this task independently green: create the four placeholder files now so the build passes, then replace their bodies in Tasks 9–12.
```tsx
// web/components/component-table.tsx (placeholder)
'use client'; export function ComponentTable(_: { itemId: string; baseUnitHint: string }) { return null; }
```
```tsx
// web/components/process-cost-table.tsx (placeholder)
'use client'; export function ProcessCostTable(_: { itemId: string }) { return null; }
```
```tsx
// web/components/price-form.tsx (placeholder)
'use client'; export function PriceForm(_: { itemId: string }) { return null; }
```
```tsx
// web/components/cost-tree.tsx (placeholder)
'use client'; export function CostTree(_: { itemId: string }) { return null; }
```

- [ ] **Step 3: Run build, verify pass**

Run: `cd web && npm run build`
Expected: succeeds (placeholders render nothing).

- [ ] **Step 4: Commit**

```bash
git add web
git commit -m "feat(web): item detail tabs and info tab"
```

---

## Task 9: Recipe builder (Resep tab) — component table + sticky HPP

**Files:** Replace placeholder `web/components/component-table.tsx`.

- [ ] **Step 1: Implement `web/components/component-table.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { useComponents, useAddComponent, useDeleteComponent, useItems, useCost } from '@/lib/query/hooks';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatIDR } from '@/lib/format';
import { t } from '@/lib/vocab';
import { ApiError } from '@/lib/api/client';
import { toast } from 'sonner';

export function ComponentTable({ itemId, baseUnitHint }: { itemId: string; baseUnitHint: string }) {
  const { data: components } = useComponents(itemId);
  const { data: allItems } = useItems();
  const { data: cost } = useCost(itemId);
  const add = useAddComponent(itemId);
  const del = useDeleteComponent(itemId);

  const [componentItemId, setComponentItemId] = useState('');
  const [quantity, setQuantity] = useState(''); const [unit, setUnit] = useState('');
  const [waste, setWaste] = useState(''); const [err, setErr] = useState<string | null>(null);

  const candidates = (allItems ?? []).filter((i) => i.id !== itemId);

  async function addRow() {
    setErr(null);
    try {
      await add.mutateAsync({ componentItemId, quantity, unit, wasteFactor: waste || undefined });
      setComponentItemId(''); setQuantity(''); setUnit(''); setWaste('');
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Gagal'); }
  }

  return (
    <div className="pb-20">
      <Table>
        <TableHeader><TableRow><TableHead>{t.materials}</TableHead><TableHead>{t.quantity}</TableHead><TableHead>{t.unit}</TableHead><TableHead>{t.waste}</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {(components ?? []).map((c) => {
            const it = (allItems ?? []).find((i) => i.id === c.componentItemId);
            return (
              <TableRow key={c.id}>
                <TableCell>{it?.name ?? c.componentItemId}</TableCell>
                <TableCell>{c.quantity}</TableCell><TableCell>{c.unit}</TableCell>
                <TableCell>{Number(c.wasteFactor) < 1 ? `${Math.round(Number(c.wasteFactor) * 100)}%` : '—'}</TableCell>
                <TableCell><Button variant="ghost" size="sm" onClick={() => del.mutate(c.id)}>Hapus</Button></TableCell>
              </TableRow>
            );
          })}
          <TableRow>
            <TableCell>
              <Select value={componentItemId} onValueChange={setComponentItemId}>
                <SelectTrigger className="w-40"><SelectValue placeholder="pilih bahan" /></SelectTrigger>
                <SelectContent>{candidates.map((i) => <SelectItem key={i.id} value={i.id}>{i.name}</SelectItem>)}</SelectContent>
              </Select>
            </TableCell>
            <TableCell><Input value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-20" /></TableCell>
            <TableCell><Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder={baseUnitHint} className="w-20" /></TableCell>
            <TableCell><Input value={waste} onChange={(e) => setWaste(e.target.value)} placeholder="1" className="w-16" /></TableCell>
            <TableCell><Button size="sm" onClick={addRow} disabled={add.isPending}>+ {t.add}</Button></TableCell>
          </TableRow>
        </TableBody>
      </Table>
      {err && <p className="text-sm text-red-600 mt-2">{err}</p>}

      <div className="fixed bottom-0 left-56 right-0 bg-slate-900 text-white px-6 py-3 flex justify-between">
        <span>{t.cost} / {cost?.baseUnit ?? ''}</span>
        <strong>{cost ? formatIDR(cost.unitCost) : '—'}</strong>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build + verify**

Run: `cd web && npm run build`
Expected: succeeds.

- [ ] **Step 3: Commit**

```bash
git add web/components/component-table.tsx
git commit -m "feat(web): recipe builder component table with sticky HPP"
```

---

## Task 10: Biaya Proses tab — process cost table

**Files:** Replace placeholder `web/components/process-cost-table.tsx`.

- [ ] **Step 1: Implement `web/components/process-cost-table.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { useProcessCosts, useAddProcessCost, useDeleteProcessCost } from '@/lib/query/hooks';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { costTypeLabel, t } from '@/lib/vocab';
import { ApiError } from '@/lib/api/client';
import type { CostType } from '@/lib/api/types';

export function ProcessCostTable({ itemId }: { itemId: string }) {
  const { data } = useProcessCosts(itemId);
  const add = useAddProcessCost(itemId);
  const del = useDeleteProcessCost(itemId);
  const [label, setLabel] = useState(''); const [costType, setCostType] = useState<CostType>('FIXED');
  const [value, setValue] = useState(''); const [err, setErr] = useState<string | null>(null);

  async function addRow() {
    setErr(null);
    try { await add.mutateAsync({ label, costType, value }); setLabel(''); setValue(''); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Gagal'); }
  }

  return (
    <div>
      <Table>
        <TableHeader><TableRow><TableHead>Label</TableHead><TableHead>Tipe</TableHead><TableHead>Nilai</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {(data ?? []).map((p) => (
            <TableRow key={p.id}>
              <TableCell>{p.label}</TableCell><TableCell>{costTypeLabel(p.costType)}</TableCell><TableCell>{p.value}</TableCell>
              <TableCell><Button variant="ghost" size="sm" onClick={() => del.mutate(p.id)}>Hapus</Button></TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="mis. Tenaga kerja" /></TableCell>
            <TableCell>
              <Select value={costType} onValueChange={(v) => setCostType(v as CostType)}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIXED">{costTypeLabel('FIXED')}</SelectItem>
                  <SelectItem value="PER_UNIT">{costTypeLabel('PER_UNIT')}</SelectItem>
                  <SelectItem value="PERCENTAGE">{costTypeLabel('PERCENTAGE')}</SelectItem>
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell><Input value={value} onChange={(e) => setValue(e.target.value)} className="w-24" /></TableCell>
            <TableCell><Button size="sm" onClick={addRow} disabled={add.isPending}>+ {t.add}</Button></TableCell>
          </TableRow>
        </TableBody>
      </Table>
      {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Build + commit**

Run: `cd web && npm run build` (expect success)
```bash
git add web/components/process-cost-table.tsx
git commit -m "feat(web): process cost table"
```

---

## Task 11: Harga tab — price form + history

**Files:** Replace placeholder `web/components/price-form.tsx`; create `web/components/price-history-table.tsx`.

- [ ] **Step 1: Implement `web/components/price-history-table.tsx`**

```tsx
'use client';
import { usePrices } from '@/lib/query/hooks';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatIDR } from '@/lib/format';

export function PriceHistoryTable({ itemId }: { itemId: string }) {
  const { data } = usePrices(itemId);
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Tanggal</TableHead><TableHead>Harga</TableHead><TableHead>Jumlah</TableHead><TableHead>Unit</TableHead><TableHead></TableHead></TableRow></TableHeader>
      <TableBody>
        {(data ?? []).map((p, i) => (
          <TableRow key={p.id}>
            <TableCell>{p.effectiveDate}</TableCell>
            <TableCell>{formatIDR(Number(p.price))}</TableCell>
            <TableCell>{p.purchaseQuantity}</TableCell>
            <TableCell>{p.purchaseUnit}</TableCell>
            <TableCell>{i === 0 && <Badge>dipakai</Badge>}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
```

- [ ] **Step 2: Implement `web/components/price-form.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { useAddPrice } from '@/lib/query/hooks';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PriceHistoryTable } from './price-history-table';
import { ApiError } from '@/lib/api/client';
import { toast } from 'sonner';

export function PriceForm({ itemId }: { itemId: string }) {
  const add = useAddPrice(itemId);
  const [price, setPrice] = useState(''); const [qty, setQty] = useState(''); const [unit, setUnit] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null);
    try {
      await add.mutateAsync({ price, purchaseQuantity: qty, purchaseUnit: unit, effectiveDate: date });
      toast.success('Harga ditambahkan'); setPrice(''); setQty(''); setUnit('');
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Gagal'); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <div><div className="text-xs text-slate-500">Harga (Rp)</div><Input value={price} onChange={(e) => setPrice(e.target.value)} className="w-28" /></div>
        <div><div className="text-xs text-slate-500">Jumlah beli</div><Input value={qty} onChange={(e) => setQty(e.target.value)} className="w-24" /></div>
        <div><div className="text-xs text-slate-500">Unit beli</div><Input value={unit} onChange={(e) => setUnit(e.target.value)} className="w-20" placeholder="kg" /></div>
        <div><div className="text-xs text-slate-500">Tanggal</div><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <Button onClick={submit} disabled={add.isPending}>Tambah Harga</Button>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}
      <PriceHistoryTable itemId={itemId} />
    </div>
  );
}
```

- [ ] **Step 3: Build + commit**

Run: `cd web && npm run build` (expect success)
```bash
git add web/components/price-form.tsx web/components/price-history-table.tsx
git commit -m "feat(web): purchase price form and history"
```

---

## Task 12: Cost-breakdown tree (HPP tab) — TDD on the recursive renderer

**Files:** Create `web/components/proportion-bar.tsx`; replace placeholder `web/components/cost-tree.tsx`; Test `web/test/cost-tree.test.tsx`.

- [ ] **Step 1: Write `web/components/proportion-bar.tsx`**

```tsx
export function ProportionBar({ material, process }: { material: number; process: number }) {
  const total = material + process || 1;
  const mPct = Math.round((material / total) * 100);
  return (
    <div className="flex h-3 rounded overflow-hidden text-[10px] text-white mt-2" aria-label="proporsi biaya">
      <div className="bg-blue-500 text-center" style={{ flex: material || 0.0001 }}>Bahan {mPct}%</div>
      <div className="bg-amber-500 text-center" style={{ flex: process || 0.0001 }}>Proses {100 - mPct}%</div>
    </div>
  );
}
```

- [ ] **Step 2: Write failing test `web/test/cost-tree.test.tsx`**

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CostNodeView } from '@/components/cost-tree';
import type { CostNode } from '@/lib/api/types';

const node: CostNode = {
  itemId: 'donut', name: 'Donat Coklat', type: 'PRODUCED', baseUnit: 'pcs', unitCost: 2450,
  breakdown: {
    materialCost: 19000, process: { fixedTotal: 3000, perUnitTotal: 2000, pctTotal: 500, lines: [] },
    yieldQuantity: 10, yieldUnit: 'pcs', totalBatchCost: 24500,
    components: [
      { itemId: 'coklat', name: 'Coklat', type: 'PURCHASED', baseUnit: 'g', unitCost: 48,
        quantity: 150, unit: 'g', grossQuantity: 187.5, lineCost: 9000 },
    ],
  },
};

describe('CostNodeView', () => {
  it('renders the node name and formatted unit cost', () => {
    render(<CostNodeView node={node} root />);
    expect(screen.getByText('Donat Coklat')).toBeInTheDocument();
    expect(screen.getByText(/Rp\s?2\.450/)).toBeInTheDocument();
  });
  it('renders a child component with its line cost', () => {
    render(<CostNodeView node={node} root />);
    expect(screen.getByText('Coklat')).toBeInTheDocument();
    expect(screen.getByText(/Rp\s?9\.000/)).toBeInTheDocument();
  });
  it('shows gross quantity when waste applied (grossQuantity != quantity)', () => {
    render(<CostNodeView node={node} root />);
    expect(screen.getByText(/187,5/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run, verify fail**

Run: `cd web && npx vitest run test/cost-tree.test.tsx`
Expected: FAIL — `CostNodeView` not exported.

- [ ] **Step 4: Implement `web/components/cost-tree.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { useCost } from '@/lib/query/hooks';
import { Skeleton } from '@/components/ui/skeleton';
import { ProportionBar } from './proportion-bar';
import { formatIDR, formatNumber } from '@/lib/format';
import { costTypeLabel, t } from '@/lib/vocab';
import type { CostNode } from '@/lib/api/types';

export function CostNodeView({ node, root = false }: { node: CostNode; root?: boolean }) {
  const [open, setOpen] = useState(root);
  const b = node.breakdown;
  const hasWaste = node.grossQuantity !== undefined && node.quantity !== undefined && node.grossQuantity !== node.quantity;

  return (
    <div className={root ? '' : 'pl-4 border-l'}>
      <div className="flex justify-between py-1">
        <button className="text-left" onClick={() => b && setOpen((o) => !o)}>
          {b ? (open ? '▾ ' : '▸ ') : '· '}{node.name}
          {node.quantity !== undefined && (
            <span className="text-slate-500"> · {formatNumber(node.quantity)} {node.unit}
              {hasWaste && <> → {formatNumber(node.grossQuantity!)} {node.unit}</>}</span>
          )}
        </button>
        <span>{node.lineCost !== undefined ? formatIDR(node.lineCost) : formatIDR(node.unitCost)}{root ? ` / ${node.baseUnit}` : ''}</span>
      </div>

      {open && b && (
        <div>
          {b.components.map((c) => <CostNodeView key={c.itemId} node={c} />)}
          {(b.process.lines.length > 0) && (
            <div className="pl-4 border-l">
              <div className="text-xs uppercase text-amber-600 py-1">{t.processCosts}</div>
              {b.process.lines.map((l, i) => (
                <div key={i} className="flex justify-between py-0.5 text-slate-600">
                  <span>· {l.label} ({costTypeLabel(l.costType)})</span><span>{formatIDR(l.amount)}</span>
                </div>
              ))}
            </div>
          )}
          {root && <ProportionBar material={b.materialCost} process={b.process.fixedTotal + b.process.perUnitTotal + b.process.pctTotal} />}
        </div>
      )}
    </div>
  );
}

export function CostTree({ itemId }: { itemId: string }) {
  const { data, isLoading, error } = useCost(itemId);
  if (isLoading) return <Skeleton className="h-40 w-full" />;
  if (error) return <p className="text-red-600">Gagal menghitung HPP: {(error as Error).message}</p>;
  if (!data) return null;
  return (
    <div>
      <div className="mb-3 text-sm text-slate-600">
        Total batch: {data.breakdown ? formatIDR(data.breakdown.totalBatchCost) : '—'} · {t.cost}/{data.baseUnit}: <strong>{formatIDR(data.unitCost)}</strong>
      </div>
      <CostNodeView node={data} root />
    </div>
  );
}
```

- [ ] **Step 5: Run, verify pass**

Run: `cd web && npx vitest run test/cost-tree.test.tsx`
Expected: PASS (3/3).

- [ ] **Step 6: Full build + all tests**

Run: `cd web && npm run build && npm test`
Expected: build succeeds; all unit tests pass.

- [ ] **Step 7: Commit**

```bash
git add web/components/cost-tree.tsx web/components/proportion-bar.tsx web/test/cost-tree.test.tsx
git commit -m "feat(web): cost-breakdown tree view"
```

---

## Task 13: Price-change ripple (/simulasi) — TDD on sort + Δ

**Files:** Create `web/lib/ripple.ts`, `web/components/ripple-panel.tsx`, `web/app/simulasi/page.tsx`; Test `web/test/ripple.test.ts`.

- [ ] **Step 1: Write failing test `web/test/ripple.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { sortRippleRows, pctChange } from '@/lib/ripple';
import type { RippleRow } from '@/lib/api/types';

const rows: RippleRow[] = [
  { itemId: 'a', name: 'Donat', oldUnitCost: 2450, newUnitCost: 2730, delta: 280 },
  { itemId: 'b', name: 'Brownies', oldUnitCost: 5200, newUnitCost: 6100, delta: 900 },
  { itemId: 'c', name: 'Filling', oldUnitCost: 48, newUnitCost: 60, delta: 12 },
];

describe('ripple', () => {
  it('pctChange computes percentage delta', () => {
    expect(pctChange(rows[2])).toBeCloseTo(25, 5); // 12/48
  });
  it('sorts by largest % impact descending', () => {
    const sorted = sortRippleRows(rows).map((r) => r.itemId);
    expect(sorted).toEqual(['c', 'b', 'a']); // 25% > 17.3% > 11.4%
  });
});
```

- [ ] **Step 2: Run, verify fail**

Run: `cd web && npx vitest run test/ripple.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `web/lib/ripple.ts`**

```ts
import type { RippleRow } from '@/lib/api/types';

export const pctChange = (r: RippleRow): number =>
  r.oldUnitCost === 0 ? Infinity : (r.delta / r.oldUnitCost) * 100;

export const sortRippleRows = (rows: RippleRow[]): RippleRow[] =>
  [...rows].sort((a, b) => pctChange(b) - pctChange(a));
```

- [ ] **Step 4: Run, verify pass**

Run: `npx vitest run test/ripple.test.ts`
Expected: PASS (2/2).

- [ ] **Step 5: Implement `web/components/ripple-panel.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { useItems, useAddPrice } from '@/lib/query/hooks';
import { api } from '@/lib/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatIDR } from '@/lib/format';
import { sortRippleRows, pctChange } from '@/lib/ripple';
import { ApiError } from '@/lib/api/client';
import type { RippleRow } from '@/lib/api/types';
import { toast } from 'sonner';

export function RipplePanel() {
  const { data: items } = useItems();
  const materials = (items ?? []).filter((i) => i.type === 'PURCHASED');
  const [itemId, setItemId] = useState('');
  const [price, setPrice] = useState(''); const [qty, setQty] = useState(''); const [unit, setUnit] = useState('');
  const [rows, setRows] = useState<RippleRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const addPrice = useAddPrice(itemId);

  async function compute() {
    setErr(null);
    try { setRows(await api.previewPriceChange({ itemId, price, purchaseQuantity: qty, purchaseUnit: unit })); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Gagal'); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-end">
        <div><div className="text-xs text-slate-500">Bahan</div>
          <Select value={itemId} onValueChange={setItemId}>
            <SelectTrigger className="w-44"><SelectValue placeholder="pilih bahan" /></SelectTrigger>
            <SelectContent>{materials.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><div className="text-xs text-slate-500">Harga baru</div><Input value={price} onChange={(e) => setPrice(e.target.value)} className="w-28" /></div>
        <div><div className="text-xs text-slate-500">Jumlah</div><Input value={qty} onChange={(e) => setQty(e.target.value)} className="w-20" /></div>
        <div><div className="text-xs text-slate-500">Unit</div><Input value={unit} onChange={(e) => setUnit(e.target.value)} className="w-20" placeholder="kg" /></div>
        <Button onClick={compute} disabled={!itemId}>Hitung Dampak</Button>
      </div>
      {err && <p className="text-sm text-red-600">{err}</p>}

      {rows && rows.length === 0 && <p className="text-slate-500">Tidak ada produk yang memakai bahan ini.</p>}
      {rows && rows.length > 0 && (
        <>
          <Table>
            <TableHeader><TableRow><TableHead>Produk</TableHead><TableHead>HPP Lama</TableHead><TableHead>HPP Baru</TableHead><TableHead>Δ</TableHead></TableRow></TableHeader>
            <TableBody>
              {sortRippleRows(rows).map((r) => (
                <TableRow key={r.itemId}>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{formatIDR(r.oldUnitCost)}</TableCell>
                  <TableCell>{formatIDR(r.newUnitCost)}</TableCell>
                  <TableCell className={r.delta >= 0 ? 'text-red-600' : 'text-green-600'}>
                    {r.delta >= 0 ? '+' : ''}{formatIDR(r.delta)} ({pctChange(r).toFixed(1)}%)
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <Button variant="outline" disabled={addPrice.isPending}
            onClick={async () => { await addPrice.mutateAsync({ price, purchaseQuantity: qty, purchaseUnit: unit, effectiveDate: new Date().toISOString().slice(0, 10) }); toast.success('Harga baru disimpan'); }}>
            Simpan harga ini
          </Button>
          <p className="text-xs text-slate-500">Ini hanya simulasi sampai kamu menyimpan harga.</p>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 6: Write `web/app/simulasi/page.tsx`**

```tsx
import { RipplePanel } from '@/components/ripple-panel';
import { t } from '@/lib/vocab';
export default function SimulasiPage() {
  return <div><h1 className="text-xl font-semibold mb-4">{t.simulation}</h1><RipplePanel /></div>;
}
```

- [ ] **Step 7: Build + tests + commit**

Run: `cd web && npm run build && npm test`
Expected: build succeeds; all tests pass.
```bash
git add web/lib/ripple.ts web/components/ripple-panel.tsx web/app/simulasi web/test/ripple.test.ts
git commit -m "feat(web): price-change ripple simulation"
```

---

## Task 14: Unit conversions admin (/konversi)

**Files:** Create `web/components/conversion-table.tsx`, `web/app/konversi/page.tsx`.

- [ ] **Step 1: Implement `web/components/conversion-table.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { useGlobalConversions, useCreateConversion, useDeleteConversion } from '@/lib/query/hooks';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ApiError } from '@/lib/api/client';

export function ConversionTable() {
  const { data } = useGlobalConversions();
  const create = useCreateConversion();
  const del = useDeleteConversion();
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [factor, setFactor] = useState('');
  const [err, setErr] = useState<string | null>(null);

  async function add() {
    setErr(null);
    try { await create.mutateAsync({ fromUnit: from, toUnit: to, factor }); setFrom(''); setTo(''); setFactor(''); }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Gagal'); }
  }

  return (
    <div>
      <p className="text-sm text-slate-500 mb-3">Konversi global, mis. 1 kg = 1000 g. (Konversi khusus item diatur di halaman item.)</p>
      <Table>
        <TableHeader><TableRow><TableHead>Dari</TableHead><TableHead>Ke</TableHead><TableHead>Faktor</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {(data ?? []).map((c) => (
            <TableRow key={c.id}>
              <TableCell>{c.fromUnit}</TableCell><TableCell>{c.toUnit}</TableCell><TableCell>{c.factor}</TableCell>
              <TableCell><Button variant="ghost" size="sm" onClick={() => del.mutate(c.id)}>Hapus</Button></TableCell>
            </TableRow>
          ))}
          <TableRow>
            <TableCell><Input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="kg" className="w-20" /></TableCell>
            <TableCell><Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="g" className="w-20" /></TableCell>
            <TableCell><Input value={factor} onChange={(e) => setFactor(e.target.value)} placeholder="1000" className="w-24" /></TableCell>
            <TableCell><Button size="sm" onClick={add} disabled={create.isPending}>+ Tambah</Button></TableCell>
          </TableRow>
        </TableBody>
      </Table>
      {err && <p className="text-sm text-red-600 mt-2">{err}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Write `web/app/konversi/page.tsx`**

```tsx
import { ConversionTable } from '@/components/conversion-table';
import { t } from '@/lib/vocab';
export default function KonversiPage() {
  return <div><h1 className="text-xl font-semibold mb-4">{t.conversions}</h1><ConversionTable /></div>;
}
```

- [ ] **Step 3: Build + commit**

Run: `cd web && npm run build` (expect success)
```bash
git add web/components/conversion-table.tsx web/app/konversi
git commit -m "feat(web): unit conversions admin"
```

---

## Task 15: End-to-end smoke + README

**Files:** Create `web/README.md`.

- [ ] **Step 1: Start backend + frontend**

Backend (repo root): ensure DB up, `npm run start:dev` (port 3000).
Frontend: `cd web && npm run dev` (port 3000 conflict — Next dev uses 3000 by default too). Set frontend port: run `cd web && PORT=3001 npm run dev`. Confirm `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000` in `web/.env.local`.

- [ ] **Step 2: Manual smoke flow (browser at http://localhost:3001)**

Verify the full path:
1. `/items` → "+ Baru" → create Bahan "Tepung" (base unit g). Create global conversion kg→g (1000) at `/konversi`.
2. Open Tepung → Harga tab → add price Rp 12000 / 1 / kg / today. History shows it with "dipakai".
3. `/items` → create Produk "Adonan" (base g, yield 1000 g). Open → Resep → add Tepung 600 g. Sticky HPP bar shows a value; HPP tab shows the tree (Tepung line Rp 7.200, HPP Rp 7,2/g).
4. `/simulasi` → pick Tepung, new price 24000 / 1 / kg → Hitung Dampak → Adonan row shows HPP lama → baru with Δ and %.
Confirm each step works and numbers are sane. If any call errors, check the backend is running and `NEXT_PUBLIC_API_BASE_URL` is correct.

- [ ] **Step 3: Write `web/README.md`**

Document: prereqs (Node, the running COGS backend), `npm install`, set `NEXT_PUBLIC_API_BASE_URL`, `PORT=3001 npm run dev`, `npm test`, `npm run build`. Brief screen list (catalog, item detail tabs, recipe builder + sticky HPP, cost tree, ripple sim, conversions) and the Indonesian-vocabulary note. State scope: no auth, talks to the Phase 1 API.

- [ ] **Step 4: Final check**

Run: `cd web && npm run build && npm test`
Expected: build succeeds; all tests pass (format, vocab, api-client, cost-tree, ripple).

- [ ] **Step 5: Commit**

```bash
git add web/README.md
git commit -m "docs(web): README and smoke test"
```

---

## Self-Review Notes (spec coverage)

- Spec §2 stack (Next.js App Router, TanStack Query, Tailwind+shadcn, IDR, no auth, env base) → Tasks 1, 2, 4, 5. ✅
- Spec §3 repo layout `/web` → Task 1. ✅
- Spec §4 data layer (typed client + ApiError, query keys, invalidation incl. broad cost invalidation on price change) → Tasks 4, 5. ✅
- Spec §5.1 sidebar shell → Task 6. ✅
- Spec §5.2 catalog (grouped, search, create) → Task 7. ✅
- Spec §5.3 item detail tabs (Info/Resep/Biaya/Harga/HPP, type-adaptive, delete) → Task 8. ✅
- Spec §5.4 recipe builder single-scroll + sticky HPP → Task 9. ✅
- Spec §5.5 nested cost tree + proportion bar + gross-on-waste → Task 12. ✅
- Spec §5.6 ripple (preview, sort by % desc, save-price, sim banner, empty state) → Task 13. ✅
- Spec §5.7 conversions admin → Task 14. ✅
- Spec §6 formatting/vocab/loading/error/empty → Tasks 3, 7, 9–14. ✅
- Spec §7 components isolated → Tasks 6–14. ✅
- Spec §8 testing (Vitest: format, vocab, api-client, CostTree, ripple) → Tasks 3, 4, 12, 13. ✅
- Spec §9 out-of-scope respected (no auth/markup/sales/optimistic). ✅

Type consistency: `CostNode`/`RippleRow`/`Item`/etc. defined once in Task 4 `lib/api/types.ts`; hooks (Task 5), components (Tasks 7–14), and tests reference those exact names. `CostNodeView` (Task 12) is the recursive unit consumed by `CostTree`. Query keys via `qk` factory (Task 5) used by all hooks.
