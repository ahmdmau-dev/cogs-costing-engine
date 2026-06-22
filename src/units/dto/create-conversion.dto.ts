import { IsOptional, IsString, IsUUID } from 'class-validator';
import { IsPositiveNumberString } from '../../common/is-positive-number-string.validator';

export class CreateConversionDto {
  @IsOptional() @IsUUID() itemId?: string; // omit = global
  @IsString() fromUnit: string;
  @IsString() toUnit: string;
  @IsPositiveNumberString() factor: string;
}
