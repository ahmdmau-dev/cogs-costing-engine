import { IsDateString, IsNumberString, IsString } from 'class-validator';
export class CreatePriceDto {
  @IsNumberString() price: string;
  @IsNumberString() purchaseQuantity: string;
  @IsString() purchaseUnit: string;
  @IsDateString() effectiveDate: string;
}
