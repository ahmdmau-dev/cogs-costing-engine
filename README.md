# COGS Costing Engine

A generic product-costing backend that computes the cost of goods sold (COGS) for items defined as either purchased raw materials or produced recipes. The engine recurses through a bill-of-materials tree, applies unit conversions, per-component waste factors, a yield quantity per produced item, and optional process costs (fixed, per-unit, or percentage), and returns a full cost-breakdown tree. Designed with food-and-beverage use cases in mind but category-generic — no F&B terminology is baked into the data layer.

## Stack

| Layer | Technology |
|---|---|
| Framework | NestJS 11 |
| ORM / DB | TypeORM 1 + PostgreSQL |
| Validation | class-validator + class-transformer |
| Decimal arithmetic | decimal.js |
| Testing | Jest 30 + ts-jest |
| Runtime | Node + ts-node (dev), compiled JS (prod) |

## Setup

### Prerequisites

- Node 18+
- PostgreSQL 14+ running locally

### Install dependencies

```bash
npm install
```

### Create the database

```bash
createdb cogs
```

Or set `DATABASE_URL` in `.env` to point at an existing database.

### Configure environment

```bash
cp .env.example .env
# Edit .env and set DATABASE_URL, e.g.:
# DATABASE_URL=postgres://youruser@localhost:5432/cogs
```

### Run migrations

```bash
npm run migration:run
```

This is idempotent — safe to run repeatedly. It creates all five tables and installs the `uuid-ossp` extension.

### Start the development server

```bash
npm run start:dev   # ts-node, hot-reloadable
# or
npm run start:prod  # builds then runs compiled JS
```

The API listens on `http://localhost:3000` by default.

### Run tests

```bash
npm test
```

27 unit tests. The costing engine, unit converter, and service layers are tested with in-memory fixtures — no database required.

## Data Model

Five entities, all with UUID primary keys. Money is stored as `numeric(18,4)` and handled in application code with decimal.js to avoid floating-point drift. The project currency is IDR (Indonesian Rupiah).

### Item

The central entity. Every thing that can be costed — whether bought or made — is an `Item`.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `name` | varchar | Display name |
| `type` | enum | `PURCHASED` or `PRODUCED` |
| `baseUnit` | varchar | Canonical unit for this item (e.g. `g`, `ml`, `pcs`) |
| `yieldQuantity` | numeric(18,4) | For PRODUCED items: how many base-units one batch yields |
| `yieldUnit` | varchar | Unit of the yield (usually matches `baseUnit`) |
| `category` | varchar | Optional free-text category |
| `notes` | text | Optional notes |

**PURCHASED** items have a purchase price and no components. Their unit cost is `price / (purchaseQuantity × conversion_factor)`.

**PRODUCED** items have a list of component items (a recipe / bill of materials) and optional process costs. Their unit cost is `totalBatchCost / yieldQuantity`.

### ItemComponent

Represents one ingredient line in a recipe.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `parentItemId` | uuid | The produced item this line belongs to |
| `componentItemId` | uuid | The ingredient (can itself be PRODUCED) |
| `quantity` | numeric(18,4) | How much of the component is used |
| `unit` | varchar | Unit of `quantity` (converted to component's `baseUnit` at compute time) |
| `wasteFactor` | numeric(18,4) | Default `1.0`. Values > 1.0 inflate gross quantity to account for trim/loss |

### PurchasePrice

Price record for a PURCHASED item. Multiple records can exist; the most recent by `effectiveDate` is used.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `itemId` | uuid | The purchased item |
| `price` | numeric(18,4) | Total price paid |
| `purchaseQuantity` | numeric(18,4) | Quantity purchased at that price |
| `purchaseUnit` | varchar | Unit of `purchaseQuantity` (converted to item's `baseUnit`) |
| `effectiveDate` | date | Used to select the latest price |

### ProcessCost

An overhead or processing cost attached to a PRODUCED item. Three types:

| `costType` | Meaning |
|---|---|
| `FIXED` | A flat amount added to the batch (e.g. packaging Rp 500) |
| `PER_UNIT` | Amount × yieldQuantity added to the batch (e.g. Rp 2/g × 1000g) |
| `PERCENTAGE` | A percentage of (materialCost + fixedTotal + perUnitTotal) added on top |

### UnitConversion

A directed conversion factor between two units. Can be global (`itemId` is null) or item-specific.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `fromUnit` | varchar | Source unit |
| `toUnit` | varchar | Target unit |
| `factor` | numeric(18,4) | `toUnit = fromUnit × factor` |
| `itemId` | uuid / null | If set, applies only to that item |

The unit converter uses BFS over the graph of known conversions and prefers item-specific edges over global ones.

## Costing Algorithm

`GET /items/:id/cost` triggers a recursive rollup:

1. If the item is **PURCHASED**: look up its latest `PurchasePrice`, convert `purchaseUnit` to `baseUnit` using the unit converter, return `unitCost = price / (purchaseQuantity × conversionFactor)`.
2. If the item is **PRODUCED**: recurse into each component, apply unit conversion and `wasteFactor`, sum line costs to get `materialCost`, add `FIXED` and `PER_UNIT` process costs, apply `PERCENTAGE` process costs on top of that base, divide by `yieldQuantity` to get `unitCost`.
3. Circular references are detected via a path set and rejected with HTTP 400.
4. All arithmetic uses decimal.js. Results are rounded to 4 decimal places.

The response is a tree (`CostNode`) with a `breakdown` that includes `components`, `process` lines, `materialCost`, `yieldQuantity`, and `totalBatchCost`.

## Endpoints

### Items

| Method | Path | Description |
|---|---|---|
| `POST` | `/items` | Create an item |
| `GET` | `/items` | List all items |
| `GET` | `/items/:id` | Get one item |
| `PATCH` | `/items/:id` | Update an item |
| `DELETE` | `/items/:id` | Delete an item |

### Components (bill of materials)

| Method | Path | Description |
|---|---|---|
| `POST` | `/items/:id/components` | Add a component to a produced item |
| `GET` | `/items/:id/components` | List components of an item |
| `DELETE` | `/components/:id` | Remove a component line |

### Purchase Prices

| Method | Path | Description |
|---|---|---|
| `POST` | `/items/:id/prices` | Add a price record |
| `GET` | `/items/:id/prices` | List price history |

### Process Costs

| Method | Path | Description |
|---|---|---|
| `POST` | `/items/:id/process-costs` | Add a process cost |
| `GET` | `/items/:id/process-costs` | List process costs for an item |
| `DELETE` | `/process-costs/:id` | Remove a process cost |

### Unit Conversions

| Method | Path | Description |
|---|---|---|
| `POST` | `/unit-conversions` | Add a global conversion |
| `GET` | `/unit-conversions` | List all global conversions |
| `GET` | `/items/:id/conversions` | List conversions for a specific item |
| `DELETE` | `/unit-conversions/:id` | Remove a conversion |

### Costing

| Method | Path | Description |
|---|---|---|
| `GET` | `/items/:id/cost` | Compute and return the full cost tree for an item |
| `POST` | `/cost/preview` | Preview the ripple effect of a hypothetical price change |

## Smoke-Test Example

This example reproduces the E2E flow used during development. It prices **Dough** (a produced item, yield 1000 g) that uses 600 g of **Flour** (purchased at Rp 12,000 / 1 kg).

```bash
# 1. Register the kg → g conversion
curl -s localhost:3000/unit-conversions \
  -H 'content-type: application/json' \
  -d '{"fromUnit":"kg","toUnit":"g","factor":"1000"}'

# 2. Create Flour and set its price
FID=$(curl -s localhost:3000/items \
  -H 'content-type: application/json' \
  -d '{"name":"Flour","type":"PURCHASED","baseUnit":"g"}' | jq -r .id)

curl -s localhost:3000/items/$FID/prices \
  -H 'content-type: application/json' \
  -d '{"price":"12000","purchaseQuantity":"1","purchaseUnit":"kg","effectiveDate":"2026-06-20"}'
# Flour unitCost: 12000 / (1 × 1000) = 12 / g

# 3. Create Dough (1000 g yield) and add Flour as a component (600 g)
DID=$(curl -s localhost:3000/items \
  -H 'content-type: application/json' \
  -d '{"name":"Dough","type":"PRODUCED","baseUnit":"g","yieldQuantity":"1000","yieldUnit":"g"}' | jq -r .id)

curl -s localhost:3000/items/$DID/components \
  -H 'content-type: application/json' \
  -d "{\"componentItemId\":\"$FID\",\"quantity\":\"600\",\"unit\":\"g\"}"

# 4. Compute cost tree
curl -s localhost:3000/items/$DID/cost | jq .
# materialCost: 600 × 12 = 7200
# unitCost: 7200 / 1000 = 7.2 / g

# 5. Preview: what happens if flour doubles to Rp 24,000 / kg?
curl -s localhost:3000/cost/preview \
  -H 'content-type: application/json' \
  -d "{\"itemId\":\"$FID\",\"price\":\"24000\",\"purchaseQuantity\":\"1\",\"purchaseUnit\":\"kg\"}" | jq .
# Dough: oldUnitCost 7.2 → newUnitCost 14.4, delta 7.2
```

Actual response from `/items/:id/cost`:

```json
{
  "itemId": "...",
  "name": "Dough",
  "type": "PRODUCED",
  "baseUnit": "g",
  "unitCost": 7.2,
  "breakdown": {
    "materialCost": 7200,
    "process": { "fixedTotal": 0, "perUnitTotal": 0, "pctTotal": 0, "lines": [] },
    "yieldQuantity": 1000,
    "yieldUnit": "g",
    "totalBatchCost": 7200,
    "components": [
      {
        "itemId": "...",
        "name": "Flour",
        "type": "PURCHASED",
        "baseUnit": "g",
        "unitCost": 12,
        "quantity": 600,
        "unit": "g",
        "grossQuantity": 600,
        "lineCost": 7200
      }
    ]
  }
}
```

Actual response from `POST /cost/preview`:

```json
[
  {
    "itemId": "...",
    "name": "Dough",
    "oldUnitCost": 7.2,
    "newUnitCost": 14.4,
    "delta": 7.2
  }
]
```

## Notes

- **Migrations only** — `synchronize: false` in the TypeORM config. Schema changes require a generated migration (`npm run migration:generate -- migrations/<Name>`).
- **Money** is stored as `numeric(18,4)` in PostgreSQL and handled as `Decimal` instances in application code using decimal.js. Results are rounded to 4 decimal places.
- **No auth, pagination, or markup/sales logic** — this is a pure costing engine. Authentication, multi-tenancy, selling price calculation, and inventory tracking are outside the current scope.
- **F&B term mapping** (e.g. Resep = recipe/produced item, Bahan = ingredient/component) is deferred to the frontend layer. The API uses generic vocabulary (`item`, `component`, `price`).
- **Currency** is IDR (Indonesian Rupiah) by convention but the system stores raw numerics — no currency symbol or conversion is enforced by the schema.
