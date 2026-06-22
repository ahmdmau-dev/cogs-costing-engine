import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UnitConversion } from './unit-conversion.entity';
import { CONVERSION_GATEWAY, TypeOrmConversionGateway } from './conversion.gateway';
import { UnitConverter } from './unit-converter';
import { UnitsController } from './units.controller';
import { UnitsService } from './units.service';

@Module({
  imports: [TypeOrmModule.forFeature([UnitConversion])],
  controllers: [UnitsController],
  providers: [
    { provide: CONVERSION_GATEWAY, useClass: TypeOrmConversionGateway },
    { provide: UnitConverter, useFactory: (gw) => new UnitConverter(gw), inject: [CONVERSION_GATEWAY] },
    UnitsService,
  ],
  exports: [UnitConverter, CONVERSION_GATEWAY, TypeOrmModule],
})
export class UnitsModule {}
