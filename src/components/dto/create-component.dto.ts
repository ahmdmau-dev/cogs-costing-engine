import { IsOptional, IsString, IsUUID } from 'class-validator';
import { IsPositiveNumberString } from '../../common/is-positive-number-string.validator';

export class CreateComponentDto {
  @IsUUID() componentItemId: string;
  @IsPositiveNumberString() quantity: string;
  @IsString() unit: string;
  @IsOptional() @IsPositiveNumberString(1) wasteFactor?: string;
}
