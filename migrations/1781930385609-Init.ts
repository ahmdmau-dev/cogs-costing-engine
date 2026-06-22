import { MigrationInterface, QueryRunner } from "typeorm";

export class Init1781930385609 implements MigrationInterface {
    name = 'Init1781930385609'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TABLE "item_components" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "parentItemId" uuid NOT NULL, "componentItemId" uuid NOT NULL, "quantity" numeric(18,4) NOT NULL, "unit" character varying NOT NULL, "wasteFactor" numeric(18,4) NOT NULL DEFAULT '1', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_c61299d4485904d94c1784d4c9f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_12ad87ade912860c9a51228557" ON "item_components"  ("parentItemId") `);
        await queryRunner.query(`CREATE TYPE "public"."items_type_enum" AS ENUM('PURCHASED', 'PRODUCED')`);
        await queryRunner.query(`CREATE TABLE "items" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "type" "public"."items_type_enum" NOT NULL, "baseUnit" character varying NOT NULL, "category" character varying, "notes" text, "yieldQuantity" numeric(18,4), "yieldUnit" character varying, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_ba5885359424c15ca6b9e79bcf6" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "purchase_prices" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "itemId" uuid NOT NULL, "price" numeric(18,4) NOT NULL, "purchaseQuantity" numeric(18,4) NOT NULL, "purchaseUnit" character varying NOT NULL, "effectiveDate" date NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_10e539399cab6d17a0d2f2bf5b4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_16c02c6b3566d93d2f58dcbb38" ON "purchase_prices"  ("itemId", "effectiveDate") `);
        await queryRunner.query(`CREATE TYPE "public"."process_costs_costtype_enum" AS ENUM('FIXED', 'PER_UNIT', 'PERCENTAGE')`);
        await queryRunner.query(`CREATE TABLE "process_costs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "itemId" uuid NOT NULL, "label" character varying NOT NULL, "costType" "public"."process_costs_costtype_enum" NOT NULL, "value" numeric(18,4) NOT NULL, CONSTRAINT "PK_99ebfa86826bea26d79c18d5a4b" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_929b12c7b7a3aededdffbd2c33" ON "process_costs"  ("itemId") `);
        await queryRunner.query(`CREATE TABLE "unit_conversions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "itemId" uuid, "fromUnit" character varying NOT NULL, "toUnit" character varying NOT NULL, "factor" numeric(24,8) NOT NULL, CONSTRAINT "PK_26f4340a0a834dbe6cf8b241c71" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_8f9a915ab58d812f605eee94bc" ON "unit_conversions"  ("itemId") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_8f9a915ab58d812f605eee94bc"`);
        await queryRunner.query(`DROP TABLE "unit_conversions"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_929b12c7b7a3aededdffbd2c33"`);
        await queryRunner.query(`DROP TABLE "process_costs"`);
        await queryRunner.query(`DROP TYPE "public"."process_costs_costtype_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_16c02c6b3566d93d2f58dcbb38"`);
        await queryRunner.query(`DROP TABLE "purchase_prices"`);
        await queryRunner.query(`DROP TABLE "items"`);
        await queryRunner.query(`DROP TYPE "public"."items_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_12ad87ade912860c9a51228557"`);
        await queryRunner.query(`DROP TABLE "item_components"`);
        await queryRunner.query(`DROP EXTENSION IF EXISTS "uuid-ossp"`);
    }

}
