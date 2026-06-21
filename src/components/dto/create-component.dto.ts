import { IsNumberString, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateComponentDto {
  @IsUUID() componentItemId: string;
  @IsNumberString() quantity: string;
  @IsString() unit: string;
  @IsOptional() @IsNumberString() wasteFactor?: string;
}
