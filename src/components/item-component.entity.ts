import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { decimalColumn } from '../common/decimal.transformer';

@Entity('item_components')
@Index(['parentItemId'])
export class ItemComponent {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') parentItemId: string;
  @Column('uuid') componentItemId: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, transformer: decimalColumn })
  quantity: string;
  @Column() unit: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, default: 1, transformer: decimalColumn })
  wasteFactor: string;
  @CreateDateColumn() createdAt: Date;
}
