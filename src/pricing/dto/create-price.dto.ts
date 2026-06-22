import { IsDateString, IsNumberString, IsString } from 'class-validator';
import { IsPositiveNumberString } from '../../common/is-positive-number-string.validator';

export class CreatePriceDto {
  @IsNumberString() price: string;
  @IsPositiveNumberString() purchaseQuantity: string;
  @IsString() purchaseUnit: string;
  @IsDateString() effectiveDate: string;
}
