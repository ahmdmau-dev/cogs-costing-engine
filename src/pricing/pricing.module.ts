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
