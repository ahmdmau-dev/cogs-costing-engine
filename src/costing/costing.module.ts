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
