import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddForeignKeys1781930400000 implements MigrationInterface {
  name = 'AddForeignKeys1781930400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "item_components" ADD CONSTRAINT "FK_ic_parent" FOREIGN KEY ("parentItemId") REFERENCES "items"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "item_components" ADD CONSTRAINT "FK_ic_component" FOREIGN KEY ("componentItemId") REFERENCES "items"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "purchase_prices" ADD CONSTRAINT "FK_pp_item" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "process_costs" ADD CONSTRAINT "FK_pc_item" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE "unit_conversions" ADD CONSTRAINT "FK_uc_item" FOREIGN KEY ("itemId") REFERENCES "items"("id") ON DELETE CASCADE`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "unit_conversions" DROP CONSTRAINT "FK_uc_item"`);
    await queryRunner.query(`ALTER TABLE "process_costs" DROP CONSTRAINT "FK_pc_item"`);
    await queryRunner.query(`ALTER TABLE "purchase_prices" DROP CONSTRAINT "FK_pp_item"`);
    await queryRunner.query(`ALTER TABLE "item_components" DROP CONSTRAINT "FK_ic_component"`);
    await queryRunner.query(`ALTER TABLE "item_components" DROP CONSTRAINT "FK_ic_parent"`);
  }
}
