import { IsEnum, IsNumberString, IsString } from 'class-validator';
import { CostType } from '../process-cost.entity';
export class CreateProcessCostDto {
  @IsString() label: string;
  @IsEnum(CostType) costType: CostType;
  @IsNumberString() value: string;
}
