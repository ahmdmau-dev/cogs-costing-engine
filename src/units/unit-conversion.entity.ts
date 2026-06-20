import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { decimalColumn } from '../common/decimal.transformer';

@Entity('unit_conversions')
@Index(['itemId'])
export class UnitConversion {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'uuid', nullable: true }) itemId: string | null; // null = global
  @Column() fromUnit: string;
  @Column() toUnit: string;
  // 1 fromUnit = factor toUnit
  @Column({ type: 'numeric', precision: 24, scale: 8, transformer: decimalColumn }) factor: string;
}
