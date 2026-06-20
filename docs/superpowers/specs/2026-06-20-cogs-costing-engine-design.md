# COGS / Product Costing Engine — Backend Phase 1 Design

**Date:** 2026-06-20
**Status:** Approved (design); pending spec review
**Scope:** NestJS backend + data model + recursive costing engine. No frontend. No pricing/markup, sales, inventory, or multi-channel logic.

## 1. Context & Goals

Product-costing app for Indonesian small businesses. First user runs an F&B business and needs cost of goods sold (COGS) per product. Launch F&B-first, but the data model and costing engine must be generic enough to later support handmade, manufacturing, reseller/trading, and services **without a database refactor**.

Core insight: a "recipe" (F&B) and a "bill of materials" (manufacturing) are the same concept — a list of `(component, quantity, unit)` rolling up into a cost. Model it generically once.

**Generalize the engine, niche the vocabulary.** DB columns stay generic (`Item`, `ItemComponent`); F&B-friendly terms (Resep, Bahan) map at the DTO/presentation layer in a later phase.

## 2. Stack

- NestJS (latest stable)
- TypeORM + PostgreSQL
- REST (no GraphQL)
- class-validator DTOs
- Jest unit tests for the costing engine
- `decimal.js` for money math
- Migrations only — **no `synchronize: true`**

## 3. Key Engineering Decisions

1. **Money math — `decimal.js` internally, `numeric(18,4)` columns.** Recursive rollup accumulates rounding error; floats are unsafe for currency. TypeORM returns `decimal` as string → wrap in `decimal.js` inside the engine, round only at output. Money in IDR.
2. **Unit resolution — BFS over a conversion graph.** Per-item edges first, then global edges, with automatic inverse (1 kg = 1000 g ⟹ 1 g = 0.001 kg). Handles multi-hop conversions (ml→L, ekor→g) without hand-entering every pair.
3. **Engine = isolated pure service.** `CostingService` takes repository data and computes the tree. Unit-tested with in-memory fixtures (mock repos); the Jest suite needs no live DB.

## 4. Data Model

### Item
Every costable thing.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| name | string | |
| type | enum | `PURCHASED` \| `PRODUCED` |
| baseUnit | string | unit the unit-cost is expressed per |
| category | string? | nullable, for UI grouping |
| notes | string? | nullable |
| yieldQuantity | decimal? | PRODUCED only; default 1 |
| yieldUnit | string? | PRODUCED only; convertible to baseUnit |
| createdAt / updatedAt | timestamp | |

- `PURCHASED`: has purchase price(s) + purchase unit. Raw materials AND resale goods.
- `PRODUCED`: no purchase price; cost derived from components + process costs.

### ItemComponent
The recursive join — links a PRODUCED parent to its component items.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| parentItemId | uuid FK Item | must be PRODUCED |
| componentItemId | uuid FK Item | PURCHASED or PRODUCED (enables multi-level BOM / semi-finished goods) |
| quantity | decimal | net amount that ends up in the product |
| unit | string | |
| wasteFactor | decimal | usable fraction, `0 < w ≤ 1`, default 1.0 |
| createdAt | timestamp | |

Constraint: `parentItemId ≠ componentItemId`. Cycle prevention — see §6.

### PurchasePrice
History for PURCHASED items; engine uses the latest.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| itemId | uuid FK Item | PURCHASED |
| price | decimal | IDR, total for purchaseQuantity |
| purchaseQuantity | decimal | |
| purchaseUnit | string | |
| effectiveDate | date | |
| createdAt | timestamp | |

Selection: latest by `effectiveDate`, tie-break `createdAt`. (Always latest — no as-of historical queries this phase.)

### ProcessCost
Non-material costs on a PRODUCED item.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| itemId | uuid FK Item | PRODUCED |
| label | string | e.g. labor, gas, packaging, overhead |
| costType | enum | `FIXED` (per batch) \| `PER_UNIT` (per output unit) \| `PERCENTAGE` |
| value | decimal | amount, or percent (e.g. 10 = 10%) |

### UnitConversion
Handles buying in one unit, using in another.

| Field | Type | Notes |
|-------|------|-------|
| id | uuid | PK |
| itemId | uuid FK Item? | null = global conversion |
| fromUnit | string | |
| toUnit | string | |
| factor | decimal | 1 fromUnit = factor toUnit |
| createdAt | timestamp | |

Resolver builds a graph: per-item edges + global edges + auto-inverse. Path found via BFS. Per-item edges take precedence over global. Same unit → factor 1.

## 5. Costing Algorithm

`computeCost(itemId, pathSet, priceOverrides?) → CostNode`

### PURCHASED
```
price/qty/unit = latest PurchasePrice  (or matching override)
qtyInBase = convert(item, purchaseUnit → baseUnit)
unitCost  = price / qtyInBase            // cost per 1 baseUnit
```

### PRODUCED
```
if itemId in pathSet: throw CircularReferenceError

for each component C:
    child       = computeCost(C.componentItemId, pathSet + itemId)
    qtyInCBase  = convert(C, C.unit → child.baseUnit)
    grossQty    = qtyInCBase / C.wasteFactor        // waste raises effective cost
    lineCost    = child.unitCost * grossQty

materialCost = Σ lineCost
fixedTotal   = Σ FIXED.value                         // per batch
perUnitTotal = Σ (PER_UNIT.value * yieldQuantity)
base         = materialCost + fixedTotal + perUnitTotal
pctTotal     = Σ (PERCENTAGE.value / 100) * base     // each % applies to the same base; no inter-% compounding
totalBatch   = base + pctTotal
unitCost     = totalBatch / yieldQuantity            // cost per output baseUnit
```

**Ordering rationale (PERCENTAGE base):** percentage costs apply to material + fixed + per-unit costs (compounding onto those), per product decision. Multiple percentage lines each apply to the *same* pre-percentage `base`, so the result is independent of their order.

**Waste vs yield (both levels):**
- `wasteFactor` on ItemComponent — usable fraction of a consumed component (buy/take 1000 g chicken, 800 g usable → `wasteFactor = 0.8`, gross = need/0.8).
- `yieldQuantity` on the PRODUCED Item — batch output (recipe makes 12 donuts → divide totalBatch by 12 for per-donut cost).

### CostNode (breakdown tree)
Returned so the UI can show "where the cost comes from", not just a number.

```
CostNode {
  itemId, name, type, baseUnit,
  unitCost,                       // per 1 baseUnit
  // present when this node is a child of a parent:
  quantity?, unit?, grossQuantity?, lineCost?,
  breakdown: {
    materialCost,
    process: { fixedTotal, perUnitTotal, pctTotal, lines: ProcessLine[] },
    yieldQuantity, yieldUnit,
    totalBatchCost,
    components: CostNode[]        // recursive children
  }
}
```

## 6. Cycle Prevention

- **Write-time:** when creating an `ItemComponent`, walk the parent's ancestor chain; reject if `componentItemId` is already an ancestor (would create a cycle). Also reject `parent == component`.
- **Compute-time:** `pathSet` carried through DFS; revisiting an id in the current path throws `CircularReferenceError`. Defense in depth against data that bypassed the write-time guard.

## 7. REST API

CRUD:
- `/items` — GET (list), POST, `GET /items/:id`, PATCH, DELETE
- `/items/:id/components` — GET, POST; `DELETE /components/:id`
- `/items/:id/prices` — GET (history), POST
- `/items/:id/process-costs` — GET, POST; `DELETE /process-costs/:id`
- `/unit-conversions` — CRUD (global); `/items/:id/conversions` — per-item

Costing:
- `GET /items/:id/cost` → full `CostNode` tree (live computation).
- `POST /cost/preview` → body `{ itemId, price, purchaseQuantity, purchaseUnit }`. Recomputes every PRODUCED item that **transitively uses** `itemId` with the hypothetical price; returns affected list `[{ itemId, name, oldUnitCost, newUnitCost, delta }]`. No DB write. (Ripple / what-if for price changes.)

DTOs use class-validator. Vocabulary stays generic; F&B term mapping deferred to a later presentation phase.

## 8. Module Structure

| Module | Responsibility |
|--------|----------------|
| `ItemsModule` | Item entity, controller, service |
| `ComponentsModule` | ItemComponent CRUD + write-time cycle guard |
| `PricingModule` | PurchasePrice |
| `ProcessCostsModule` | ProcessCost |
| `UnitsModule` | UnitConversion + `UnitConverter` (BFS resolver) |
| `CostingModule` | `CostingService` engine + cost/preview controller |

Each unit has one clear purpose, communicates through repositories/services, and is independently testable. The engine depends on repos + `UnitConverter` only.

## 9. Test Coverage (Jest, engine)

`CostingService` and `UnitConverter` with in-memory fixtures:

1. Simple PURCHASED item — normalize price to per-baseUnit.
2. Single-level recipe — components roll up.
3. Multi-level recipe — semi-finished good (base dough) reused across products.
4. Unit conversion — global (kg→g) and per-item (1 ekor ayam = 1000 g).
5. Component waste factor — `wasteFactor < 1` raises effective cost.
6. Output yield divisor — batch yield divides total to per-unit.
7. PERCENTAGE process cost — applies to material + fixed + per-unit base; order-independent across multiple % lines.
8. Circular-reference rejection — compute-time `CircularReferenceError`.

## 10. Out of Scope (this phase)

Pricing/markup, sales recording, inventory, multi-channel, frontend, as-of historical cost queries, bulk recompute endpoint, authentication.
