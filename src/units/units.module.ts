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
