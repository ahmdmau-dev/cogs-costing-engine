import { IsNumberString, IsString, IsUUID } from 'class-validator';
export class PreviewDto {
  @IsUUID() itemId: string;
  @IsNumberString() price: string;
  @IsNumberString() purchaseQuantity: string;
  @IsString() purchaseUnit: string;
}
