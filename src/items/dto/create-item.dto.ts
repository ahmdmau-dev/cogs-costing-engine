import { IsEnum, IsOptional, IsString, IsNumberString } from 'class-validator';
import { ItemType } from '../item.entity';

export class CreateItemDto {
  @IsString() name: string;
  @IsEnum(ItemType) type: ItemType;
  @IsString() baseUnit: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsNumberString() yieldQuantity?: string;
  @IsOptional() @IsString() yieldUnit?: string;
}
