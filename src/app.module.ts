import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppDataSource } from './data-source';
import { ItemsModule } from './items/items.module';
import { ComponentsModule } from './components/components.module';
import { PricingModule } from './pricing/pricing.module';
import { ProcessCostsModule } from './process-costs/process-costs.module';
import { UnitsModule } from './units/units.module';
import { CostingModule } from './costing/costing.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({ ...AppDataSource.options, autoLoadEntities: true }),
    ItemsModule,
    ComponentsModule,
    PricingModule,
    ProcessCostsModule,
    UnitsModule,
    CostingModule,
  ],
})
export class AppModule {}
