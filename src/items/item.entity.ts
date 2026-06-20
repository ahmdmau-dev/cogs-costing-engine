import {
  Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn,
} from 'typeorm';
import { decimalColumn } from '../common/decimal.transformer';

export enum ItemType {
  PURCHASED = 'PURCHASED',
  PRODUCED = 'PRODUCED',
}

@Entity('items')
export class Item {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column() name: string;
  @Column({ type: 'enum', enum: ItemType }) type: ItemType;
  @Column() baseUnit: string;
  @Column({ type: 'varchar', nullable: true }) category: string | null;
  @Column({ type: 'text', nullable: true }) notes: string | null;

  @Column({ type: 'numeric', precision: 18, scale: 4, nullable: true, transformer: decimalColumn })
  yieldQuantity: string | null;
  @Column({ type: 'varchar', nullable: true }) yieldUnit: string | null;

  @CreateDateColumn() createdAt: Date;
  @UpdateDateColumn() updatedAt: Date;
}
