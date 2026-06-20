# COGS Costing Engine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a NestJS + TypeORM + PostgreSQL backend that models generic costable items (recipes = bills of materials) and a recursive costing engine returning a full cost-breakdown tree.

**Architecture:** Generic recursive `Item` model (`PURCHASED` | `PRODUCED`) joined by `ItemComponent`. A pure `CostingService` rolls cost up through components, applying unit conversion (BFS resolver), per-component waste, process costs, and output yield. The engine talks to data through a `CostingGateway` interface (TypeORM-backed in prod, in-memory in tests) so the Jest suite needs no DB. Money uses `decimal.js` internally, `numeric(18,4)` columns.

**Tech Stack:** NestJS, TypeORM, PostgreSQL, class-validator, decimal.js, Jest.

---

## File Structure

```
src/
  app.module.ts
  main.ts
  data-source.ts                      # TypeORM DataSource for migrations
  common/
    decimal.transformer.ts            # numeric <-> string column transformer
    decimal.util.ts                   # D() factory, round helper
  items/
    item.entity.ts                    # Item + ItemType enum
    items.module.ts
    items.service.ts
    items.controller.ts
    dto/create-item.dto.ts
    dto/update-item.dto.ts
  components/
    item-component.entity.ts
    components.module.ts
    components.service.ts              # CRUD + write-time cycle guard
    components.controller.ts
    dto/create-component.dto.ts
  pricing/
    purchase-price.entity.ts
    pricing.module.ts
    pricing.service.ts
    pricing.controller.ts
    dto/create-price.dto.ts
  process-costs/
    process-cost.entity.ts            # ProcessCost + CostType enum
    process-costs.module.ts
    process-costs.service.ts
    process-costs.controller.ts
    dto/create-process-cost.dto.ts
  units/
    unit-conversion.entity.ts
    units.module.ts
    units.service.ts                  # CRUD
    units.controller.ts
    unit-converter.ts                 # BFS resolver (pure)
    conversion.gateway.ts             # interface + TypeORM impl
    dto/create-conversion.dto.ts
  costing/
    cost-node.interface.ts            # CostNode, CostBreakdown, ProcessLine
    costing.gateway.ts                # CostingGateway interface + TypeORM impl
    costing.service.ts                # the engine
    costing.module.ts
    costing.controller.ts             # GET /items/:id/cost, POST /cost/preview
    dto/preview.dto.ts
test/
  units/unit-converter.spec.ts
  costing/costing.service.spec.ts
  costing/fixtures.ts                 # in-memory gateway + fixture builders
migrations/
  <ts>-Init.ts
```

---

## Task 1: Scaffold project + tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `nest-cli.json`, `.env.example`, `src/main.ts`, `src/app.module.ts`, `src/data-source.ts`, `.gitignore`

- [ ] **Step 1: Init Nest project structure and install deps**

Run from repo root:
```bash
npm init -y
npm i @nestjs/common@^11 @nestjs/core@^11 @nestjs/platform-express@^11 @nestjs/typeorm@^11 typeorm pg class-validator class-transformer decimal.js reflect-metadata rxjs
npm i -D typescript @types/node ts-node tsconfig-paths @nestjs/cli @nestjs/testing jest ts-jest @types/jest
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2021",
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "strict": true,
    "strictPropertyInitialization": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "baseUrl": "./",
    "declaration": false
  },
  "include": ["src/**/*", "test/**/*", "migrations/**/*"]
}
```

- [ ] **Step 3: Write `nest-cli.json`**

```json
{ "$schema": "https://json.schemastore.org/nest-cli", "collection": "@nestjs/schematics", "sourceRoot": "src" }
```

- [ ] **Step 4: Write `.gitignore`**

```
node_modules
dist
.env
*.log
```

- [ ] **Step 5: Write `.env.example`**

```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/cogs
```

- [ ] **Step 6: Write `src/data-source.ts`** (used by TypeORM CLI for migrations and imported by AppModule)

```ts
import 'reflect-metadata';
import { DataSource } from 'typeorm';

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/cogs',
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../migrations/*{.ts,.js}'],
  synchronize: false,
  logging: false,
});
```

- [ ] **Step 7: Write `src/app.module.ts`** (modules wired in as later tasks add them)

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppDataSource } from './data-source';

@Module({
  imports: [TypeOrmModule.forRoot({ ...AppDataSource.options, autoLoadEntities: true })],
})
export class AppModule {}
```

- [ ] **Step 8: Write `src/main.ts`**

```ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

- [ ] **Step 9: Add scripts to `package.json`** (merge into `"scripts"`)

```json
{
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start:dev": "ts-node -r tsconfig-paths/register src/main.ts",
    "test": "jest",
    "typeorm": "typeorm-ts-node-commonjs -d src/data-source.ts",
    "migration:generate": "npm run typeorm -- migration:generate",
    "migration:run": "npm run typeorm -- migration:run"
  }
}
```

- [ ] **Step 10: Write `jest.config.js`**

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/test', '<rootDir>/src'],
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
};
```

- [ ] **Step 11: Verify build + empty test run**

Run: `npm run build && npx jest --passWithNoTests`
Expected: build succeeds, Jest reports no tests without error.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "chore: scaffold NestJS + TypeORM project"
```

---

## Task 2: Decimal utilities

**Files:**
- Create: `src/common/decimal.util.ts`, `src/common/decimal.transformer.ts`
- Test: `src/common/decimal.util.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/common/decimal.util.spec.ts
import { D, round } from './decimal.util';

describe('decimal.util', () => {
  it('D parses string and number', () => {
    expect(D('12.5').plus(D(2)).toString()).toBe('14.5');
  });
  it('round returns a number with given dp (default 2)', () => {
    expect(round(D('12.005'))).toBe(12.01);
    expect(round(D('12.0049'), 2)).toBe(12.0);
    expect(round(D('1.23456'), 4)).toBe(1.2346);
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx jest src/common/decimal.util.spec.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/common/decimal.util.ts
import Decimal from 'decimal.js';

export { Decimal };
export const D = (v: Decimal.Value): Decimal => new Decimal(v);

export function round(value: Decimal, dp = 2): number {
  return value.toDecimalPlaces(dp, Decimal.ROUND_HALF_UP).toNumber();
}
```

- [ ] **Step 4: Write the column transformer**

```ts
// src/common/decimal.transformer.ts
import { ValueTransformer } from 'typeorm';

// Stores numbers as numeric strings, reads them back as strings (engine wraps in Decimal).
export class DecimalTransformer implements ValueTransformer {
  to(value: number | string | null): string | null {
    return value === null || value === undefined ? null : value.toString();
  }
  from(value: string | null): string | null {
    return value;
  }
}
export const decimalColumn = new DecimalTransformer();
```

- [ ] **Step 5: Run test, verify pass**

Run: `npx jest src/common/decimal.util.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: decimal utilities and numeric column transformer"
```

---

## Task 3: Entities + initial migration

**Files:**
- Create: `src/items/item.entity.ts`, `src/components/item-component.entity.ts`, `src/pricing/purchase-price.entity.ts`, `src/process-costs/process-cost.entity.ts`, `src/units/unit-conversion.entity.ts`
- Create: `migrations/<ts>-Init.ts` (generated)

- [ ] **Step 1: Write `Item` entity + enum**

```ts
// src/items/item.entity.ts
import {
  Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { decimalColumn } from '../common/decimal.transformer';

export enum ItemType {
  PURCHASED = 'PURCHASED',
  PRODUCED = 'PRODUCED',
}

@Entity('items')
export class Item {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Column({ type: 'enum', enum: ItemType }) type: ItemType;
  @Column() baseUnit: string;
  @Column({ type: 'varchar', nullable: true }) category: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;

  // PRODUCED only; defaults applied in costing engine when null.
  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true, transformer: decimalColumn })
  yieldQuantity: string | null;
  @Column({ type: 'varchar', nullable: true }) yieldUnit: string | null;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
```

- [ ] **Step 2: Write `ItemComponent` entity**

```ts
// src/components/item-component.entity.ts
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { decimalColumn } from '../common/decimal.transformer';

@Entity('item_components')
@Index(['parentItemId'])
export class ItemComponent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') parentItemId: string;
  @Column('uuid') componentItemId: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, transformer: decimalColumn })
  quantity: string;
  @Column() unit: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 1, transformer: decimalColumn })
  wasteFactor: string;
  @CreateDateColumn() createdAt: Date;
}
```

- [ ] **Step 3: Write `PurchasePrice` entity**

```ts
// src/pricing/purchase-price.entity.ts
import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { decimalColumn } from '../common/decimal.transformer';

@Entity('purchase_prices')
@Index(['itemId', 'effectiveDate'])
export class PurchasePrice {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') itemId: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, transformer: decimalColumn }) price: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, transformer: decimalColumn })
  purchaseQuantity: string;
  @Column() purchaseUnit: string;
  @Column({ type: 'date' }) effectiveDate: string;
  @CreateDateColumn() createdAt: Date;
}
```

- [ ] **Step 4: Write `ProcessCost` entity + enum**

```ts
// src/process-costs/process-cost.entity.ts
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { decimalColumn } from '../common/decimal.transformer';

export enum CostType {
  FIXED = 'FIXED',
  PER_UNIT = 'PER_UNIT',
  PERCENTAGE = 'PERCENTAGE',
}

@Entity('process_costs')
@Index(['itemId'])
export class ProcessCost {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') itemId: string;
  @Column() label: string;
  @Column({ type: 'enum', enum: CostType }) costType: CostType;
  @Column({ type: 'numeric', precision: 18, scale: 4, transformer: decimalColumn }) value: string;
}
```

- [ ] **Step 5: Write `UnitConversion` entity**

```ts
// src/units/unit-conversion.entity.ts
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { decimalColumn } from '../common/decimal.transformer';

@Entity('unit_conversions')
@Index(['itemId'])
export class UnitConversion {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', nullable: true }) itemId: string | null; // null = global
  @Column() fromUnit: string;
  @Column() toUnit: string;
  // 1 fromUnit = factor toUnit
  @Column({ type: 'numeric', precision: 24, scale: 8, transformer: decimalColumn }) factor: string;
}
```

- [ ] **Step 6: Generate the migration**

Ensure a local Postgres `cogs` DB exists (`createdb cogs` or via Docker). Then:
```bash
npm run build
npm run migration:generate -- migrations/Init
```
Expected: a file `migrations/<timestamp>-Init.ts` containing `CREATE TABLE` for all five tables + enum types.

- [ ] **Step 7: Run the migration**

Run: `npm run migration:run`
Expected: migration applied, tables created.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: core entities and initial migration"
```

---

## Task 4: Unit converter (BFS resolver)

The converter resolves a multiplicative factor from one unit to another over a graph of conversion edges. Per-item edges take precedence over global; inverse edges are implicit.

**Files:**
- Create: `src/units/conversion.gateway.ts`, `src/units/unit-converter.ts`
- Test: `test/units/unit-converter.spec.ts`

- [ ] **Step 1: Write the gateway interface**

```ts
// src/units/conversion.gateway.ts
export interface ConversionEdge {
  itemId: string | null; // null = global
  fromUnit: string;
  toUnit: string;
  factor: string; // 1 fromUnit = factor toUnit
}

export interface ConversionGateway {
  // All edges relevant to an item: its own + global. Order irrelevant.
  getEdges(itemId: string | null): Promise<ConversionEdge[]>;
}

export const CONVERSION_GATEWAY = Symbol('CONVERSION_GATEWAY');
```

- [ ] **Step 2: Write the failing test**

```ts
// test/units/unit-converter.spec.ts
import { UnitConverter } from '../../src/units/unit-converter';
import { ConversionEdge, ConversionGateway } from '../../src/units/conversion.gateway';

function gateway(edges: ConversionEdge[]): ConversionGateway {
  return {
    getEdges: async (itemId) =>
      edges.filter((e) => e.itemId === null || e.itemId === itemId),
  };
}
const g = (fromUnit: string, toUnit: string, factor: string): ConversionEdge => ({
  itemId: null, fromUnit, toUnit, factor,
});

describe('UnitConverter', () => {
  it('returns 1 when units are equal', async () => {
    const c = new UnitConverter(gateway([]));
    expect((await c.factor('g', 'g', null)).toString()).toBe('1');
  });

  it('resolves a direct global edge', async () => {
    const c = new UnitConverter(gateway([g('kg', 'g', '1000')]));
    expect((await c.factor('kg', 'g', null)).toString()).toBe('1000');
  });

  it('resolves the implicit inverse', async () => {
    const c = new UnitConverter(gateway([g('kg', 'g', '1000')]));
    expect((await c.factor('g', 'kg', null)).toString()).toBe('0.001');
  });

  it('resolves a multi-hop path', async () => {
    const c = new UnitConverter(gateway([g('L', 'ml', '1000'), g('ml', 'tsp', '0.2')]));
    // 1 L = 1000 ml = 200 tsp
    expect((await c.factor('L', 'tsp', null)).toString()).toBe('200');
  });

  it('prefers a per-item edge over a global one', async () => {
    const c = new UnitConverter(
      gateway([
        g('ekor', 'g', '500'),
        { itemId: 'chicken', fromUnit: 'ekor', toUnit: 'g', factor: '1000' },
      ]),
    );
    expect((await c.factor('ekor', 'g', 'chicken')).toString()).toBe('1000');
  });

  it('throws when no path exists', async () => {
    const c = new UnitConverter(gateway([g('kg', 'g', '1000')]));
    await expect(c.factor('g', 'ml', null)).rejects.toThrow(/No conversion path/);
  });
});
```

- [ ] **Step 3: Run test, verify it fails**

Run: `npx jest test/units/unit-converter.spec.ts`
Expected: FAIL — `UnitConverter` not found.

- [ ] **Step 4: Implement the converter**

```ts
// src/units/unit-converter.ts
import { D, Decimal } from '../common/decimal.util';
import { ConversionEdge, ConversionGateway } from './conversion.gateway';

interface Edge { to: string; factor: Decimal; itemScoped: boolean }

export class UnitConverter {
  constructor(private readonly gateway: ConversionGateway) {}

  async factor(fromUnit: string, toUnit: string, itemId: string | null): Promise<Decimal> {
    if (fromUnit === toUnit) return D(1);

    const edges = await this.gateway.getEdges(itemId);
    const adj = this.buildAdjacency(edges, itemId);

    // BFS carrying the accumulated factor; per-item edges already prioritized in adjacency.
    const queue: Array<{ unit: string; factor: Decimal }> = [{ unit: fromUnit, factor: D(1) }];
    const seen = new Set<string>([fromUnit]);

    while (queue.length) {
      const { unit, factor } = queue.shift()!;
      for (const e of adj.get(unit) ?? []) {
        if (e.to === toUnit) return factor.mul(e.factor);
        if (!seen.has(e.to)) {
          seen.add(e.to);
          queue.push({ unit: e.to, factor: factor.mul(e.factor) });
        }
      }
    }
    throw new Error(`No conversion path from "${fromUnit}" to "${toUnit}" (item: ${itemId ?? 'global'})`);
  }

  private buildAdjacency(edges: ConversionEdge[], itemId: string | null): Map<string, Edge[]> {
    const adj = new Map<string, Edge[]>();
    const push = (from: string, to: string, factor: Decimal, itemScoped: boolean) => {
      const list = adj.get(from) ?? [];
      // Per-item edges go to the front so BFS reaches them first.
      if (itemScoped) list.unshift({ to, factor, itemScoped });
      else list.push({ to, factor, itemScoped });
      adj.set(from, list);
    };
    for (const e of edges) {
      const scoped = e.itemId !== null && e.itemId === itemId;
      const f = D(e.factor);
      push(e.fromUnit, e.toUnit, f, scoped);
      push(e.toUnit, e.fromUnit, D(1).div(f), scoped); // implicit inverse
    }
    return adj;
  }
}
```

- [ ] **Step 5: Run test, verify pass**

Run: `npx jest test/units/unit-converter.spec.ts`
Expected: PASS (all 6 cases).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: BFS unit converter with per-item precedence"
```

---

## Task 5: Costing engine

The engine is the core. It recurses through components, applies waste and unit conversion, sums process costs (with PERCENTAGE applying to material+fixed+per-unit base), and divides by output yield. It is tested entirely against an in-memory gateway.

**Files:**
- Create: `src/costing/cost-node.interface.ts`, `src/costing/costing.gateway.ts`, `src/costing/costing.service.ts`
- Test: `test/costing/fixtures.ts`, `test/costing/costing.service.spec.ts`

- [ ] **Step 1: Write the CostNode interfaces**

```ts
// src/costing/cost-node.interface.ts
import { ItemType } from '../items/item.entity';
import { CostType } from '../process-costs/process-cost.entity';

export interface ProcessLine {
  label: string;
  costType: CostType;
  value: number;   // the configured value (amount or percent)
  amount: number;  // contribution to the batch total, in IDR
}

export interface CostBreakdown {
  materialCost: number;
  process: { fixedTotal: number; perUnitTotal: number; pctTotal: number; lines: ProcessLine[] };
  yieldQuantity: number;
  yieldUnit: string | null;
  totalBatchCost: number;
  components: CostNode[];
}

export interface CostNode {
  itemId: string;
  name: string;
  type: ItemType;
  baseUnit: string;
  unitCost: number;            // cost per 1 baseUnit
  // present only when this node is a child of a parent:
  quantity?: number;
  unit?: string;
  grossQuantity?: number;      // quantity / wasteFactor, in component baseUnit
  lineCost?: number;           // unitCost * grossQuantity
  breakdown?: CostBreakdown;   // present for PRODUCED items
}
```

- [ ] **Step 2: Write the costing gateway interface**

```ts
// src/costing/costing.gateway.ts
import { ItemType } from '../items/item.entity';
import { CostType } from '../process-costs/process-cost.entity';

export interface ItemData {
  id: string;
  name: string;
  type: ItemType;
  baseUnit: string;
  yieldQuantity: string | null;
  yieldUnit: string | null;
}
export interface ComponentData {
  componentItemId: string;
  quantity: string;
  unit: string;
  wasteFactor: string;
}
export interface PriceData {
  price: string;
  purchaseQuantity: string;
  purchaseUnit: string;
}
export interface ProcessCostData { label: string; costType: CostType; value: string }

export interface PriceOverride {
  itemId: string;
  price: string;
  purchaseQuantity: string;
  purchaseUnit: string;
}

export interface CostingGateway {
  getItem(id: string): Promise<ItemData | null>;
  getComponents(parentId: string): Promise<ComponentData[]>;
  getLatestPrice(itemId: string): Promise<PriceData | null>;
  getProcessCosts(itemId: string): Promise<ProcessCostData[]>;
}

export const COSTING_GATEWAY = Symbol('COSTING_GATEWAY');

export class CircularReferenceError extends Error {
  constructor(itemId: string) {
    super(`Circular reference detected at item ${itemId}`);
    this.name = 'CircularReferenceError';
  }
}
export class ItemNotFoundError extends Error {
  constructor(itemId: string) {
    super(`Item ${itemId} not found`);
    this.name = 'ItemNotFoundError';
  }
}
export class MissingPriceError extends Error {
  constructor(itemId: string) {
    super(`PURCHASED item ${itemId} has no purchase price`);
    this.name = 'MissingPriceError';
  }
}
```

- [ ] **Step 3: Write the in-memory test fixtures**

```ts
// test/costing/fixtures.ts
import { CostingGateway, ItemData, ComponentData, PriceData, ProcessCostData } from '../../src/costing/costing.gateway';
import { ConversionEdge, ConversionGateway } from '../../src/units/conversion.gateway';

export interface World {
  items: Record<string, ItemData>;
  components: Record<string, ComponentData[]>;
  prices: Record<string, PriceData>;
  processCosts: Record<string, ProcessCostData[]>;
  edges: ConversionEdge[];
}

export function emptyWorld(): World {
  return { items: {}, components: {}, prices: {}, processCosts: {}, edges: [] };
}

export function costingGateway(w: World): CostingGateway {
  return {
    getItem: async (id) => w.items[id] ?? null,
    getComponents: async (id) => w.components[id] ?? [],
    getLatestPrice: async (id) => w.prices[id] ?? null,
    getProcessCosts: async (id) => w.processCosts[id] ?? [],
  };
}

export function conversionGateway(w: World): ConversionGateway {
  return {
    getEdges: async (itemId) => w.edges.filter((e) => e.itemId === null || e.itemId === itemId),
  };
}

// builders
export function purchased(w: World, id: string, baseUnit: string, price: string, qty: string, unit: string) {
  w.items[id] = { id, name: id, type: 'PURCHASED' as any, baseUnit, yieldQuantity: null, yieldUnit: null };
  w.prices[id] = { price, purchaseQuantity: qty, purchaseUnit: unit };
}
export function produced(w: World, id: string, baseUnit: string, yieldQuantity: string, yieldUnit: string) {
  w.items[id] = { id, name: id, type: 'PRODUCED' as any, baseUnit, yieldQuantity, yieldUnit };
  w.components[id] = w.components[id] ?? [];
  w.processCosts[id] = w.processCosts[id] ?? [];
}
export function component(w: World, parent: string, child: string, quantity: string, unit: string, wasteFactor = '1') {
  (w.components[parent] = w.components[parent] ?? []).push({ componentItemId: child, quantity, unit, wasteFactor });
}
export function globalEdge(w: World, fromUnit: string, toUnit: string, factor: string) {
  w.edges.push({ itemId: null, fromUnit, toUnit, factor });
}
export function itemEdge(w: World, itemId: string, fromUnit: string, toUnit: string, factor: string) {
  w.edges.push({ itemId, fromUnit, toUnit, factor });
}
```

- [ ] **Step 4: Write the failing engine test (all spec scenarios)**

```ts
// test/costing/costing.service.spec.ts
import { CostingService } from '../../src/costing/costing.service';
import { UnitConverter } from '../../src/units/unit-converter';
import { CircularReferenceError } from '../../src/costing/costing.gateway';
import {
  World, emptyWorld, costingGateway, conversionGateway,
  purchased, produced, component, globalEdge, itemEdge,
} from './fixtures';

function engine(w: World): CostingService {
  return new CostingService(costingGateway(w), new UnitConverter(conversionGateway(w)));
}

describe('CostingService', () => {
  it('1. simple purchased item: price normalized to base unit', async () => {
    const w = emptyWorld();
    globalEdge(w, 'kg', 'g', '1000');
    // flour: Rp12000 per 1kg, baseUnit g  -> 12 per g
    purchased(w, 'flour', 'g', '12000', '1', 'kg');
    const node = await engine(w).computeCost('flour');
    expect(node.unitCost).toBe(12);
  });

  it('2. single-level recipe rolls up component costs', async () => {
    const w = emptyWorld();
    globalEdge(w, 'kg', 'g', '1000');
    purchased(w, 'flour', 'g', '12000', '1', 'kg'); // 12/g
    purchased(w, 'sugar', 'g', '15000', '1', 'kg'); // 15/g
    produced(w, 'dough', 'g', '1000', 'g');         // batch makes 1000g
    component(w, 'dough', 'flour', '600', 'g');      // 600 * 12 = 7200
    component(w, 'dough', 'sugar', '100', 'g');      // 100 * 15 = 1500
    const node = await engine(w).computeCost('dough');
    expect(node.breakdown!.materialCost).toBe(8700);
    expect(node.unitCost).toBe(8.7); // 8700 / 1000g
  });

  it('3. multi-level recipe reuses a semi-finished good', async () => {
    const w = emptyWorld();
    globalEdge(w, 'kg', 'g', '1000');
    purchased(w, 'flour', 'g', '10000', '1', 'kg'); // 10/g
    produced(w, 'dough', 'g', '1000', 'g');
    component(w, 'dough', 'flour', '500', 'g');      // 5000 / 1000g = 5/g
    produced(w, 'donut', 'pcs', '10', 'pcs');        // batch makes 10 donuts
    component(w, 'donut', 'dough', '200', 'g');      // 200g * 5/g = 1000
    const node = await engine(w).computeCost('donut');
    expect(node.breakdown!.materialCost).toBe(1000);
    expect(node.unitCost).toBe(100); // 1000 / 10 donuts
  });

  it('4. per-item unit conversion (1 ekor = 1000 g)', async () => {
    const w = emptyWorld();
    // chicken bought Rp50000 per ekor, baseUnit g, 1 ekor = 1000g -> 50/g
    purchased(w, 'chicken', 'g', '50000', '1', 'ekor');
    itemEdge(w, 'chicken', 'ekor', 'g', '1000');
    const node = await engine(w).computeCost('chicken');
    expect(node.unitCost).toBe(50);
  });

  it('5. component waste factor raises effective cost', async () => {
    const w = emptyWorld();
    purchased(w, 'chicken', 'g', '50', '1', 'g'); // 50/g
    produced(w, 'dish', 'porsi', '1', 'porsi');
    component(w, 'dish', 'chicken', '800', 'g', '0.8'); // need 800g usable, 80% yield -> gross 1000g
    const node = await engine(w).computeCost('dish');
    const line = node.breakdown!.components[0];
    expect(line.grossQuantity).toBe(1000);
    expect(line.lineCost).toBe(50000);
    expect(node.unitCost).toBe(50000);
  });

  it('6. output yield divides batch cost', async () => {
    const w = emptyWorld();
    purchased(w, 'flour', 'g', '10', '1', 'g'); // 10/g
    produced(w, 'cookies', 'pcs', '24', 'pcs'); // batch makes 24
    component(w, 'cookies', 'flour', '480', 'g'); // 4800 / 24 = 200
    const node = await engine(w).computeCost('cookies');
    expect(node.breakdown!.totalBatchCost).toBe(4800);
    expect(node.unitCost).toBe(200);
  });

  it('7. PERCENTAGE process cost applies to material+fixed+per-unit base, order-independent', async () => {
    const w = emptyWorld();
    purchased(w, 'flour', 'g', '10', '1', 'g'); // 10/g
    produced(w, 'cake', 'pcs', '1', 'pcs');
    component(w, 'cake', 'flour', '100', 'g'); // material 1000
    w.processCosts['cake'] = [
      { label: 'labor', costType: 'FIXED' as any, value: '500' },         // +500
      { label: 'packaging', costType: 'PER_UNIT' as any, value: '200' },  // +200 * yield(1) = 200
      { label: 'overhead', costType: 'PERCENTAGE' as any, value: '10' },  // 10% of (1000+500+200)=170
      { label: 'profit-buffer', costType: 'PERCENTAGE' as any, value: '5' }, // 5% of 1700 = 85
    ];
    const node = await engine(w).computeCost('cake');
    // base = 1700, pct = 170 + 85 = 255, total = 1955
    expect(node.breakdown!.process.fixedTotal).toBe(500);
    expect(node.breakdown!.process.perUnitTotal).toBe(200);
    expect(node.breakdown!.process.pctTotal).toBe(255);
    expect(node.breakdown!.totalBatchCost).toBe(1955);
    expect(node.unitCost).toBe(1955);
  });

  it('8. rejects a circular reference', async () => {
    const w = emptyWorld();
    produced(w, 'a', 'g', '1', 'g');
    produced(w, 'b', 'g', '1', 'g');
    component(w, 'a', 'b', '1', 'g');
    component(w, 'b', 'a', '1', 'g'); // cycle
    await expect(engine(w).computeCost('a')).rejects.toBeInstanceOf(CircularReferenceError);
  });
});
```

- [ ] **Step 5: Run test, verify it fails**

Run: `npx jest test/costing/costing.service.spec.ts`
Expected: FAIL — `CostingService` not found.

- [ ] **Step 6: Implement the engine**

```ts
// src/costing/costing.service.ts
import { D, Decimal, round } from '../common/decimal.util';
import { UnitConverter } from '../units/unit-converter';
import { ItemType } from '../items/item.entity';
import { CostType } from '../process-costs/process-cost.entity';
import { CostNode, ProcessLine } from './cost-node.interface';
import {
  CostingGateway, PriceOverride, CircularReferenceError, ItemNotFoundError, MissingPriceError,
} from './costing.gateway';

export class CostingService {
  constructor(
    private readonly gateway: CostingGateway,
    private readonly converter: UnitConverter,
  ) {}

  async computeCost(
    itemId: string,
    opts: { pathSet?: Set<string>; priceOverride?: PriceOverride } = {},
  ): Promise<CostNode> {
    const pathSet = opts.pathSet ?? new Set<string>();
    const item = await this.gateway.getItem(itemId);
    if (!item) throw new ItemNotFoundError(itemId);

    if (item.type === ItemType.PURCHASED) {
      return this.computePurchased(item, opts.priceOverride);
    }

    if (pathSet.has(itemId)) throw new CircularReferenceError(itemId);
    const childPath = new Set(pathSet).add(itemId);
    return this.computeProduced(item, childPath, opts.priceOverride);
  }

  private async computePurchased(
    item: { id: string; name: string; baseUnit: string },
    override?: PriceOverride,
  ): Promise<CostNode> {
    const price =
      override && override.itemId === item.id
        ? { price: override.price, purchaseQuantity: override.purchaseQuantity, purchaseUnit: override.purchaseUnit }
        : await this.gateway.getLatestPrice(item.id);
    if (!price) throw new MissingPriceError(item.id);

    const factor = await this.converter.factor(price.purchaseUnit, item.baseUnit, item.id);
    const qtyInBase = D(price.purchaseQuantity).mul(factor);
    const unitCost = D(price.price).div(qtyInBase);
    return {
      itemId: item.id, name: item.name, type: ItemType.PURCHASED, baseUnit: item.baseUnit,
      unitCost: round(unitCost, 4),
    };
  }

  private async computeProduced(
    item: { id: string; name: string; baseUnit: string; yieldQuantity: string | null; yieldUnit: string | null },
    pathSet: Set<string>,
    override?: PriceOverride,
  ): Promise<CostNode> {
    const components = await this.gateway.getComponents(item.id);
    const childNodes: CostNode[] = [];
    let materialCost = D(0);

    for (const c of components) {
      const child = await this.computeCost(c.componentItemId, { pathSet, priceOverride: override });
      const convFactor = await this.converter.factor(c.unit, child.baseUnit, c.componentItemId);
      const qtyInBase = D(c.quantity).mul(convFactor);
      const grossQty = qtyInBase.div(D(c.wasteFactor));        // waste raises cost
      const lineCost = D(child.unitCost).mul(grossQty);
      materialCost = materialCost.plus(lineCost);
      childNodes.push({
        ...child,
        quantity: round(D(c.quantity), 4),
        unit: c.unit,
        grossQuantity: round(grossQty, 4),
        lineCost: round(lineCost, 4),
      });
    }

    const yieldQty = item.yieldQuantity ? D(item.yieldQuantity) : D(1);
    const processCosts = await this.gateway.getProcessCosts(item.id);

    let fixedTotal = D(0);
    let perUnitTotal = D(0);
    let pctSum = D(0);
    const lines: ProcessLine[] = [];

    for (const p of processCosts) {
      if (p.costType === CostType.FIXED) fixedTotal = fixedTotal.plus(D(p.value));
      else if (p.costType === CostType.PER_UNIT) perUnitTotal = perUnitTotal.plus(D(p.value).mul(yieldQty));
      else if (p.costType === CostType.PERCENTAGE) pctSum = pctSum.plus(D(p.value));
    }

    const base = materialCost.plus(fixedTotal).plus(perUnitTotal);
    const pctTotal = base.mul(pctSum).div(100);

    // Build per-line amounts after base is known (percentage lines need the base).
    for (const p of processCosts) {
      let amount = D(0);
      if (p.costType === CostType.FIXED) amount = D(p.value);
      else if (p.costType === CostType.PER_UNIT) amount = D(p.value).mul(yieldQty);
      else amount = base.mul(D(p.value)).div(100);
      lines.push({ label: p.label, costType: p.costType, value: round(D(p.value), 4), amount: round(amount) });
    }

    const totalBatch = base.plus(pctTotal);
    const unitCost = totalBatch.div(yieldQty);

    return {
      itemId: item.id, name: item.name, type: ItemType.PRODUCED, baseUnit: item.baseUnit,
      unitCost: round(unitCost, 4),
      breakdown: {
        materialCost: round(materialCost),
        process: {
          fixedTotal: round(fixedTotal),
          perUnitTotal: round(perUnitTotal),
          pctTotal: round(pctTotal),
          lines,
        },
        yieldQuantity: yieldQty.toNumber(),
        yieldUnit: item.yieldUnit,
        totalBatchCost: round(totalBatch),
        components: childNodes,
      },
    };
  }
}
```

- [ ] **Step 7: Run test, verify all 8 pass**

Run: `npx jest test/costing/costing.service.spec.ts`
Expected: PASS (8/8).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: recursive costing engine with breakdown tree"
```

---

## Task 6: TypeORM gateways + costing module wiring

Wire the engine to real repositories and register the converter as an injectable.

**Files:**
- Create: `src/costing/costing.module.ts`, `src/units/units.module.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Implement the TypeORM conversion gateway** (append to `src/units/conversion.gateway.ts`)

```ts
// --- append to src/units/conversion.gateway.ts ---
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnitConversion } from './unit-conversion.entity';

@Injectable()
export class TypeOrmConversionGateway implements ConversionGateway {
  constructor(@InjectRepository(UnitConversion) private readonly repo: Repository<UnitConversion>) {}
  async getEdges(itemId: string | null): Promise<ConversionEdge[]> {
    const rows = await this.repo
      .createQueryBuilder('c')
      .where('c.itemId IS NULL')
      .orWhere(itemId ? 'c.itemId = :itemId' : '1 = 0', { itemId })
      .getMany();
    return rows.map((r) => ({ itemId: r.itemId, fromUnit: r.fromUnit, toUnit: r.toUnit, factor: r.factor }));
  }
}
```

- [ ] **Step 2: Implement the TypeORM costing gateway** (append to `src/costing/costing.gateway.ts`)

```ts
// --- append to src/costing/costing.gateway.ts ---
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Item } from '../items/item.entity';
import { ItemComponent } from '../components/item-component.entity';
import { PurchasePrice } from '../pricing/purchase-price.entity';
import { ProcessCost } from '../process-costs/process-cost.entity';

@Injectable()
export class TypeOrmCostingGateway implements CostingGateway {
  constructor(
    @InjectRepository(Item) private readonly items: Repository<Item>,
    @InjectRepository(ItemComponent) private readonly components: Repository<ItemComponent>,
    @InjectRepository(PurchasePrice) private readonly prices: Repository<PurchasePrice>,
    @InjectRepository(ProcessCost) private readonly processCosts: Repository<ProcessCost>,
  ) {}

  async getItem(id: string): Promise<ItemData | null> {
    const i = await this.items.findOne({ where: { id } });
    return i ? { id: i.id, name: i.name, type: i.type, baseUnit: i.baseUnit, yieldQuantity: i.yieldQuantity, yieldUnit: i.yieldUnit } : null;
  }
  async getComponents(parentId: string): Promise<ComponentData[]> {
    const rows = await this.components.find({ where: { parentItemId: parentId } });
    return rows.map((r) => ({ componentItemId: r.componentItemId, quantity: r.quantity, unit: r.unit, wasteFactor: r.wasteFactor }));
  }
  async getLatestPrice(itemId: string): Promise<PriceData | null> {
    const p = await this.prices.findOne({ where: { itemId }, order: { effectiveDate: 'DESC', createdAt: 'DESC' } });
    return p ? { price: p.price, purchaseQuantity: p.purchaseQuantity, purchaseUnit: p.purchaseUnit } : null;
  }
  async getProcessCosts(itemId: string): Promise<ProcessCostData[]> {
    const rows = await this.processCosts.find({ where: { itemId } });
    return rows.map((r) => ({ label: r.label, costType: r.costType, value: r.value }));
  }
}
```

- [ ] **Step 3: Write `units.module.ts`**

```ts
// src/units/units.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UnitConversion } from './unit-conversion.entity';
import { CONVERSION_GATEWAY, TypeOrmConversionGateway } from './conversion.gateway';
import { UnitConverter } from './unit-converter';

@Module({
  imports: [TypeOrmModule.forFeature([UnitConversion])],
  providers: [
    { provide: CONVERSION_GATEWAY, useClass: TypeOrmConversionGateway },
    { provide: UnitConverter, useFactory: (gw) => new UnitConverter(gw), inject: [CONVERSION_GATEWAY] },
  ],
  exports: [UnitConverter, CONVERSION_GATEWAY, TypeOrmModule],
})
export class UnitsModule {}
```

- [ ] **Step 4: Write `costing.module.ts`**

```ts
// src/costing/costing.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Item } from '../items/item.entity';
import { ItemComponent } from '../components/item-component.entity';
import { PurchasePrice } from '../pricing/purchase-price.entity';
import { ProcessCost } from '../process-costs/process-cost.entity';
import { UnitsModule } from '../units/units.module';
import { UnitConverter } from '../units/unit-converter';
import { COSTING_GATEWAY, TypeOrmCostingGateway, CostingGateway } from './costing.gateway';
import { CostingService } from './costing.service';
import { CostingController } from './costing.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Item, ItemComponent, PurchasePrice, ProcessCost]), UnitsModule],
  controllers: [CostingController],
  providers: [
    { provide: COSTING_GATEWAY, useClass: TypeOrmCostingGateway },
    {
      provide: CostingService,
      useFactory: (gw: CostingGateway, conv: UnitConverter) => new CostingService(gw, conv),
      inject: [COSTING_GATEWAY, UnitConverter],
    },
  ],
  exports: [CostingService, COSTING_GATEWAY],
})
export class CostingModule {}
```

- [ ] **Step 5: Verify existing tests still pass + build**

Run: `npx jest && npm run build`
Expected: engine + converter tests PASS. Build fails only on the not-yet-created `CostingController` — create it in Task 9 before wiring into AppModule. For now comment out the `controllers` line if needed, or proceed to Task 9 before building. (Implementer note: skip `npm run build` until Task 9.)

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: TypeORM gateways and costing/units module wiring"
```

---

## Task 7: Items CRUD

**Files:**
- Create: `src/items/dto/create-item.dto.ts`, `src/items/dto/update-item.dto.ts`, `src/items/items.service.ts`, `src/items/items.controller.ts`, `src/items/items.module.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: Write DTOs**

```ts
// src/items/dto/create-item.dto.ts
import { IsEnum, IsOptional, IsString, IsNumberString } from 'class-validator';
import { ItemType } from '../item.entity';

export class CreateItemDto {
  @IsString() name: string;
  @IsEnum(ItemType) type: ItemType;
  @IsString() baseUnit: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsNumberString() yieldQuantity?: string;
  @IsOptional() @IsString() yieldUnit?: string;
}
```

```ts
// src/items/dto/update-item.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateItemDto } from './create-item.dto';
export class UpdateItemDto extends PartialType(CreateItemDto) {}
```

Install mapped-types if missing: `npm i @nestjs/mapped-types`.

- [ ] **Step 2: Write the service**

```ts
// src/items/items.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Item } from './item.entity';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';

@Injectable()
export class ItemsService {
  constructor(@InjectRepository(Item) private readonly repo: Repository<Item>) {}

  create(dto: CreateItemDto) {
    return this.repo.save(this.repo.create(dto));
  }
  findAll() {
    return this.repo.find({ order: { createdAt: 'DESC' } });
  }
  async findOne(id: string) {
    const item = await this.repo.findOne({ where: { id } });
    if (!item) throw new NotFoundException(`Item ${id} not found`);
    return item;
  }
  async update(id: string, dto: UpdateItemDto) {
    const item = await this.findOne(id);
    Object.assign(item, dto);
    return this.repo.save(item);
  }
  async remove(id: string) {
    await this.findOne(id);
    await this.repo.delete(id);
    return { deleted: true };
  }
}
```

- [ ] **Step 3: Write the controller**

```ts
// src/items/items.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';

@Controller('items')
export class ItemsController {
  constructor(private readonly service: ItemsService) {}
  @Post() create(@Body() dto: CreateItemDto) { return this.service.create(dto); }
  @Get() findAll() { return this.service.findAll(); }
  @Get(':id') findOne(@Param('id') id: string) { return this.service.findOne(id); }
  @Patch(':id') update(@Param('id') id: string, @Body() dto: UpdateItemDto) { return this.service.update(id, dto); }
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}
```

- [ ] **Step 4: Write the module**

```ts
// src/items/items.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Item } from './item.entity';
import { ItemsService } from './items.service';
import { ItemsController } from './items.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Item])],
  controllers: [ItemsController],
  providers: [ItemsService],
})
export class ItemsModule {}
```

- [ ] **Step 5: Add `ItemsModule` to `app.module.ts` imports**

```ts
// in src/app.module.ts imports array, add: ItemsModule
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: items CRUD"
```

---

## Task 8: Components (+ cycle guard), pricing, process costs, conversions CRUD

**Files:**
- Create: `src/components/*` (service with cycle guard, controller, module, dto)
- Create: `src/pricing/*`, `src/process-costs/*`, `src/units/units.service.ts`, `src/units/units.controller.ts`, dtos
- Test: `src/components/components.service.spec.ts`
- Modify: `src/app.module.ts`, `src/units/units.module.ts`

- [ ] **Step 1: Write component DTO**

```ts
// src/components/dto/create-component.dto.ts
import { IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateComponentDto {
  @IsUUID() componentItemId: string;
  @IsNumberString() quantity: string;
  @IsString() unit: string;
  @IsOptional() @IsNumberString() wasteFactor?: string;
}
```

- [ ] **Step 2: Write the failing cycle-guard test**

```ts
// src/components/components.service.spec.ts
import { wouldCreateCycle } from './cycle.util';

// adjacency: parent -> [componentIds]
const graph: Record<string, string[]> = {
  donut: ['dough'],
  dough: ['flour'],
};
const ancestorsOf = async (id: string): Promise<string[]> => {
  // who has `id` as a component, transitively
  const result: string[] = [];
  const visit = (target: string) => {
    for (const [parent, children] of Object.entries(graph)) {
      if (children.includes(target)) { result.push(parent); visit(parent); }
    }
  };
  visit(id);
  return result;
};

describe('cycle guard', () => {
  it('flags adding an ancestor as a component (dough -> donut would cycle)', async () => {
    // parent=dough, adding component=donut; donut is an ancestor of dough
    expect(await wouldCreateCycle('dough', 'donut', ancestorsOf)).toBe(true);
  });
  it('allows a non-cyclic component', async () => {
    expect(await wouldCreateCycle('dough', 'sugar', ancestorsOf)).toBe(false);
  });
  it('flags self-reference', async () => {
    expect(await wouldCreateCycle('dough', 'dough', ancestorsOf)).toBe(true);
  });
});
```

- [ ] **Step 3: Run test, verify it fails**

Run: `npx jest src/components/components.service.spec.ts`
Expected: FAIL — `cycle.util` not found.

- [ ] **Step 4: Implement the cycle util**

```ts
// src/components/cycle.util.ts
// Returns true if making `componentId` a component of `parentId` would create a cycle:
// i.e. componentId === parentId, or componentId is already an ancestor of parentId.
export async function wouldCreateCycle(
  parentId: string,
  componentId: string,
  ancestorsOf: (id: string) => Promise<string[]>,
): Promise<boolean> {
  if (parentId === componentId) return true;
  const ancestors = await ancestorsOf(parentId);
  return ancestors.includes(componentId);
}
```

- [ ] **Step 5: Run test, verify pass**

Run: `npx jest src/components/components.service.spec.ts`
Expected: PASS (3/3).

- [ ] **Step 6: Write the components service using the guard**

```ts
// src/components/components.service.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ItemComponent } from './item-component.entity';
import { CreateComponentDto } from './dto/create-component.dto';
import { wouldCreateCycle } from './cycle.util';

@Injectable()
export class ComponentsService {
  constructor(@InjectRepository(ItemComponent) private readonly repo: Repository<ItemComponent>) {}

  // transitive ancestors of an item via the item_components edges
  private ancestorsOf = async (id: string): Promise<string[]> => {
    const result = new Set<string>();
    const visit = async (target: string) => {
      const parents = await this.repo.find({ where: { componentItemId: target } });
      for (const p of parents) {
        if (!result.has(p.parentItemId)) {
          result.add(p.parentItemId);
          await visit(p.parentItemId);
        }
      }
    };
    await visit(id);
    return [...result];
  };

  async create(parentItemId: string, dto: CreateComponentDto) {
    if (await wouldCreateCycle(parentItemId, dto.componentItemId, this.ancestorsOf)) {
      throw new BadRequestException('This component would create a circular reference');
    }
    return this.repo.save(
      this.repo.create({
        parentItemId,
        componentItemId: dto.componentItemId,
        quantity: dto.quantity,
        unit: dto.unit,
        wasteFactor: dto.wasteFactor ?? '1',
      }),
    );
  }
  findForParent(parentItemId: string) {
    return this.repo.find({ where: { parentItemId } });
  }
  async remove(id: string) {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException(`Component ${id} not found`);
    await this.repo.delete(id);
    return { deleted: true };
  }
}
```

- [ ] **Step 7: Write the components controller + module**

```ts
// src/components/components.controller.ts
import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ComponentsService } from './components.service';
import { CreateComponentDto } from './dto/create-component.dto';

@Controller()
export class ComponentsController {
  constructor(private readonly service: ComponentsService) {}
  @Post('items/:id/components')
  create(@Param('id') id: string, @Body() dto: CreateComponentDto) { return this.service.create(id, dto); }
  @Get('items/:id/components')
  list(@Param('id') id: string) { return this.service.findForParent(id); }
  @Delete('components/:id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
```

```ts
// src/components/components.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItemComponent } from './item-component.entity';
import { ComponentsService } from './components.service';
import { ComponentsController } from './components.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ItemComponent])],
  controllers: [ComponentsController],
  providers: [ComponentsService],
})
export class ComponentsModule {}
```

- [ ] **Step 8: Write pricing module (entity already exists)**

```ts
// src/pricing/dto/create-price.dto.ts
import { IsDateString, IsNumberString, IsString } from 'class-validator';
export class CreatePriceDto {
  @IsNumberString() price: string;
  @IsNumberString() purchaseQuantity: string;
  @IsString() purchaseUnit: string;
  @IsDateString() effectiveDate: string;
}
```

```ts
// src/pricing/pricing.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PurchasePrice } from './purchase-price.entity';
import { CreatePriceDto } from './dto/create-price.dto';

@Injectable()
export class PricingService {
  constructor(@InjectRepository(PurchasePrice) private readonly repo: Repository<PurchasePrice>) {}
  create(itemId: string, dto: CreatePriceDto) {
    return this.repo.save(this.repo.create({ itemId, ...dto }));
  }
  history(itemId: string) {
    return this.repo.find({ where: { itemId }, order: { effectiveDate: 'DESC', createdAt: 'DESC' } });
  }
}
```

```ts
// src/pricing/pricing.controller.ts
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { CreatePriceDto } from './dto/create-price.dto';

@Controller('items/:id/prices')
export class PricingController {
  constructor(private readonly service: PricingService) {}
  @Post() create(@Param('id') id: string, @Body() dto: CreatePriceDto) { return this.service.create(id, dto); }
  @Get() history(@Param('id') id: string) { return this.service.history(id); }
}
```

```ts
// src/pricing/pricing.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PurchasePrice } from './purchase-price.entity';
import { PricingService } from './pricing.service';
import { PricingController } from './pricing.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PurchasePrice])],
  controllers: [PricingController],
  providers: [PricingService],
})
export class PricingModule {}
```

- [ ] **Step 9: Write process-costs module**

```ts
// src/process-costs/dto/create-process-cost.dto.ts
import { IsEnum, IsNumberString, IsString } from 'class-validator';
import { CostType } from '../process-cost.entity';
export class CreateProcessCostDto {
  @IsString() label: string;
  @IsEnum(CostType) costType: CostType;
  @IsNumberString() value: string;
}
```

```ts
// src/process-costs/process-costs.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcessCost } from './process-cost.entity';
import { CreateProcessCostDto } from './dto/create-process-cost.dto';

@Injectable()
export class ProcessCostsService {
  constructor(@InjectRepository(ProcessCost) private readonly repo: Repository<ProcessCost>) {}
  create(itemId: string, dto: CreateProcessCostDto) {
    return this.repo.save(this.repo.create({ itemId, ...dto }));
  }
  list(itemId: string) { return this.repo.find({ where: { itemId } }); }
  async remove(id: string) {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException(`Process cost ${id} not found`);
    await this.repo.delete(id);
    return { deleted: true };
  }
}
```

```ts
// src/process-costs/process-costs.controller.ts
import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { ProcessCostsService } from './process-costs.service';
import { CreateProcessCostDto } from './dto/create-process-cost.dto';

@Controller()
export class ProcessCostsController {
  constructor(private readonly service: ProcessCostsService) {}
  @Post('items/:id/process-costs')
  create(@Param('id') id: string, @Body() dto: CreateProcessCostDto) { return this.service.create(id, dto); }
  @Get('items/:id/process-costs')
  list(@Param('id') id: string) { return this.service.list(id); }
  @Delete('process-costs/:id')
  remove(@Param('id') id: string) { return this.service.remove(id); }
}
```

```ts
// src/process-costs/process-costs.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcessCost } from './process-cost.entity';
import { ProcessCostsService } from './process-costs.service';
import { ProcessCostsController } from './process-costs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ProcessCost])],
  controllers: [ProcessCostsController],
  providers: [ProcessCostsService],
})
export class ProcessCostsModule {}
```

- [ ] **Step 10: Write unit-conversions CRUD (service + controller, added to UnitsModule)**

```ts
// src/units/dto/create-conversion.dto.ts
import { IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';
export class CreateConversionDto {
  @IsOptional() @IsUUID() itemId?: string; // omit = global
  @IsString() fromUnit: string;
  @IsString() toUnit: string;
  @IsNumberString() factor: string;
}
```

```ts
// src/units/units.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { UnitConversion } from './unit-conversion.entity';
import { CreateConversionDto } from './dto/create-conversion.dto';

@Injectable()
export class UnitsService {
  constructor(@InjectRepository(UnitConversion) private readonly repo: Repository<UnitConversion>) {}
  create(dto: CreateConversionDto) {
    return this.repo.save(this.repo.create({ itemId: dto.itemId ?? null, fromUnit: dto.fromUnit, toUnit: dto.toUnit, factor: dto.factor }));
  }
  listGlobal() { return this.repo.find({ where: { itemId: IsNull() } }); }
  listForItem(itemId: string) { return this.repo.find({ where: { itemId } }); }
  async remove(id: string) {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException(`Conversion ${id} not found`);
    await this.repo.delete(id);
    return { deleted: true };
  }
}
```

```ts
// src/units/units.controller.ts
import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { UnitsService } from './units.service';
import { CreateConversionDto } from './dto/create-conversion.dto';

@Controller()
export class UnitsController {
  constructor(private readonly service: UnitsService) {}
  @Post('unit-conversions') create(@Body() dto: CreateConversionDto) { return this.service.create(dto); }
  @Get('unit-conversions') listGlobal() { return this.service.listGlobal(); }
  @Get('items/:id/conversions') listForItem(@Param('id') id: string) { return this.service.listForItem(id); }
  @Delete('unit-conversions/:id') remove(@Param('id') id: string) { return this.service.remove(id); }
}
```

- [ ] **Step 11: Register controller + service in `units.module.ts`** (add to providers/controllers)

```ts
// in src/units/units.module.ts:
//   controllers: [UnitsController],
//   providers: [ ...existing, UnitsService ],
// and import UnitsController + UnitsService at top.
```

- [ ] **Step 12: Add modules to `app.module.ts`**

```ts
// app.module.ts imports: add ComponentsModule, PricingModule, ProcessCostsModule, UnitsModule, CostingModule, ItemsModule
```

- [ ] **Step 13: Run all unit tests**

Run: `npx jest`
Expected: converter, engine, cycle-guard tests PASS.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat: components (cycle guard), pricing, process costs, conversions CRUD"
```

---

## Task 9: Cost endpoints (tree + ripple preview)

**Files:**
- Create: `src/costing/dto/preview.dto.ts`, `src/costing/costing.controller.ts`
- Modify: `src/costing/costing.service.ts` (add `previewPriceChange`), `src/costing/costing.gateway.ts` (add `findParentsUsing`)

- [ ] **Step 1: Add a "who uses this item" lookup to the gateway interface** (edit `CostingGateway` in `src/costing/costing.gateway.ts`)

Add this method to the `CostingGateway` interface:
```ts
  // direct parents that list itemId as a component
  getDirectParents(itemId: string): Promise<string[]>;
```
And implement it in `TypeOrmCostingGateway`:
```ts
  async getDirectParents(itemId: string): Promise<string[]> {
    const rows = await this.components.find({ where: { componentItemId: itemId } });
    return [...new Set(rows.map((r) => r.parentItemId))];
  }
```
Also add `getDirectParents` to the in-memory `costingGateway` in `test/costing/fixtures.ts`:
```ts
    getDirectParents: async (id) =>
      Object.entries(w.components)
        .filter(([, list]) => list.some((c) => c.componentItemId === id))
        .map(([parent]) => parent),
```

- [ ] **Step 2: Write the failing preview test** (append to `test/costing/costing.service.spec.ts`)

```ts
  it('9. preview: price change ripples to all transitive parents', async () => {
    const w = emptyWorld();
    purchased(w, 'flour', 'g', '10', '1', 'g'); // 10/g
    produced(w, 'dough', 'g', '1000', 'g');
    component(w, 'dough', 'flour', '500', 'g');  // 5000/1000 = 5/g
    produced(w, 'donut', 'pcs', '10', 'pcs');
    component(w, 'donut', 'dough', '200', 'g');  // 200*5 = 1000 -> 100/donut
    const svc = engine(w);
    const affected = await svc.previewPriceChange({
      itemId: 'flour', price: '20', purchaseQuantity: '1', purchaseUnit: 'g', // double price
    });
    const byId = Object.fromEntries(affected.map((a) => [a.itemId, a]));
    expect(byId['dough'].oldUnitCost).toBe(5);
    expect(byId['dough'].newUnitCost).toBe(10);
    expect(byId['donut'].oldUnitCost).toBe(100);
    expect(byId['donut'].newUnitCost).toBe(200);
    expect(byId['donut'].delta).toBe(100);
  });
```

- [ ] **Step 3: Run, verify fail**

Run: `npx jest test/costing/costing.service.spec.ts -t "preview"`
Expected: FAIL — `previewPriceChange` not a function.

- [ ] **Step 4: Implement `previewPriceChange`** (add to `CostingService`; add the `getDirectParents` collection helper)

```ts
  // add to CostingService
  async previewPriceChange(override: import('./costing.gateway').PriceOverride) {
    const affectedIds = await this.collectTransitiveParents(override.itemId);
    const results: Array<{ itemId: string; name: string; oldUnitCost: number; newUnitCost: number; delta: number }> = [];
    for (const id of affectedIds) {
      const before = await this.computeCost(id);
      const after = await this.computeCost(id, { priceOverride: override });
      results.push({
        itemId: id,
        name: before.name,
        oldUnitCost: before.unitCost,
        newUnitCost: after.unitCost,
        delta: round(D(after.unitCost).minus(D(before.unitCost)), 4),
      });
    }
    return results;
  }

  private async collectTransitiveParents(itemId: string): Promise<string[]> {
    const found = new Set<string>();
    const visit = async (id: string) => {
      const parents = await this.gateway.getDirectParents(id);
      for (const p of parents) {
        if (!found.has(p)) { found.add(p); await visit(p); }
      }
    };
    await visit(itemId);
    return [...found];
  }
```

- [ ] **Step 5: Run, verify pass**

Run: `npx jest test/costing/costing.service.spec.ts`
Expected: PASS (9/9).

- [ ] **Step 6: Write the preview DTO + controller**

```ts
// src/costing/dto/preview.dto.ts
import { IsNumberString, IsString, IsUUID } from 'class-validator';
export class PreviewDto {
  @IsUUID() itemId: string;
  @IsNumberString() price: string;
  @IsNumberString() purchaseQuantity: string;
  @IsString() purchaseUnit: string;
}
```

```ts
// src/costing/costing.controller.ts
import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CostingService } from './costing.service';
import { PreviewDto } from './dto/preview.dto';

@Controller()
export class CostingController {
  constructor(private readonly service: CostingService) {}
  @Get('items/:id/cost')
  cost(@Param('id') id: string) { return this.service.computeCost(id); }
  @Post('cost/preview')
  preview(@Body() dto: PreviewDto) { return this.service.previewPriceChange(dto); }
}
```

- [ ] **Step 7: Full build + all tests**

Run: `npm run build && npx jest`
Expected: build succeeds, all tests PASS.

- [ ] **Step 8: Map exceptions to HTTP (optional polish)**

In `costing.controller.ts`, wrap `computeCost`/`preview` so engine errors return proper status. Add a try/catch translating `ItemNotFoundError → NotFoundException`, `CircularReferenceError`/`MissingPriceError → BadRequestException`:
```ts
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CircularReferenceError, ItemNotFoundError, MissingPriceError } from './costing.gateway';

private translate(e: unknown): never {
  if (e instanceof ItemNotFoundError) throw new NotFoundException(e.message);
  if (e instanceof CircularReferenceError || e instanceof MissingPriceError) throw new BadRequestException(e.message);
  throw e;
}
```
Wrap each handler body in `try { ... } catch (e) { this.translate(e); }`.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: cost tree and price-change ripple preview endpoints"
```

---

## Task 10: Manual smoke test + README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Start the app against a live DB**

Run: `npm run migration:run && npm run start:dev`
Expected: server listening on :3000.

- [ ] **Step 2: Smoke-test the flow with curl**

```bash
# create global kg->g
curl -s localhost:3000/unit-conversions -H 'content-type: application/json' \
  -d '{"fromUnit":"kg","toUnit":"g","factor":"1000"}'
# create flour (PURCHASED), add price
FID=$(curl -s localhost:3000/items -H 'content-type: application/json' \
  -d '{"name":"Flour","type":"PURCHASED","baseUnit":"g"}' | jq -r .id)
curl -s localhost:3000/items/$FID/prices -H 'content-type: application/json' \
  -d '{"price":"12000","purchaseQuantity":"1","purchaseUnit":"kg","effectiveDate":"2026-06-20"}'
# create dough (PRODUCED), add flour component
DID=$(curl -s localhost:3000/items -H 'content-type: application/json' \
  -d '{"name":"Dough","type":"PRODUCED","baseUnit":"g","yieldQuantity":"1000","yieldUnit":"g"}' | jq -r .id)
curl -s localhost:3000/items/$DID/components -H 'content-type: application/json' \
  -d "{\"componentItemId\":\"$FID\",\"quantity\":\"600\",\"unit\":\"g\"}"
# cost tree
curl -s localhost:3000/items/$DID/cost | jq .
# ripple preview: flour price doubles
curl -s localhost:3000/cost/preview -H 'content-type: application/json' \
  -d "{\"itemId\":\"$FID\",\"price\":\"24000\",\"purchaseQuantity\":\"1\",\"purchaseUnit\":\"kg\"}" | jq .
```
Expected: cost tree shows `unitCost` for dough (7.2/g); preview shows dough new unit cost rising.

- [ ] **Step 3: Write `README.md`** documenting setup (env, `migration:run`, `start:dev`), the entity model, and the endpoint list from the spec §7.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: README and manual smoke test"
```

---

## Self-Review Notes (spec coverage)

- Spec §4 entities → Tasks 2, 3. ✅
- Spec §5 algorithm (waste, yield, % base = material+fixed+per-unit, latest price) → Task 5 + tests 1–7. ✅
- Spec §6 cycle prevention: write-time → Task 8 (cycle.util + service); compute-time → Task 5 (test 8). ✅
- Spec §7 API: CRUD → Tasks 7, 8; `GET /items/:id/cost` + `POST /cost/preview` → Task 9. ✅
- Spec §8 module structure → Tasks 6–9. ✅
- Spec §9 test coverage (8 scenarios) → Task 5 tests 1–8; ripple → Task 9 test 9. ✅
- Spec §2 migrations not synchronize, decimal money → Tasks 1–3. ✅
