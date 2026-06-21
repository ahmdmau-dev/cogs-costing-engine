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
