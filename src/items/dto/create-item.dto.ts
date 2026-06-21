import { IsEnum, IsNotEmpty, IsOptional, IsString, IsNumberString } from 'class-validator';
import { ItemType } from '../item.entity';

export class CreateItemDto {
  @IsString() @IsNotEmpty() name: string;
  @IsEnum(ItemType) type: ItemType;
  @IsString() @IsNotEmpty() baseUnit: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsNumberString() yieldQuantity?: string;
  @IsOptional() @IsString() yieldUnit?: string;
}
