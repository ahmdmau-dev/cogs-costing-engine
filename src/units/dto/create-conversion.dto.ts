import { IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';
export class CreateConversionDto {
  @IsOptional() @IsUUID() itemId?: string; // omit = global
  @IsString() fromUnit: string;
  @IsString() toUnit: string;
  @IsNumberString() factor: string;
}
