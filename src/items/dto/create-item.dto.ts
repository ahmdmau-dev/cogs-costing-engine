import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ItemType } from '../item.entity';
import { IsPositiveNumberString } from '../../common/is-positive-number-string.validator';

export class CreateItemDto {
  @IsString() @IsNotEmpty() name: string;
  @IsEnum(ItemType) type: ItemType;
  @IsString() @IsNotEmpty() baseUnit: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsPositiveNumberString() yieldQuantity?: string;
  @IsOptional() @IsString() yieldUnit?: string;
}
