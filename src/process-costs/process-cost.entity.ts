import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { decimalColumn } from '../common/decimal.transformer';

export enum CostType {
  FIXED = 'FIXED',
  PER_UNIT = 'PER_UNIT',
  PERCENTAGE = 'PERCENTAGE',
}

@Entity('process_costs')
@Index(['itemId'])
export class ProcessCost {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') itemId: string;
  @Column() label: string;
  @Column({ type: 'enum', enum: CostType }) costType: CostType;
  @Column({ type: 'numeric', precision: 18, scale: 4, transformer: decimalColumn }) value: string;
}
