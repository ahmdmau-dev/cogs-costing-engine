import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { decimalColumn } from '../common/decimal.transformer';

@Entity('purchase_prices')
@Index(['itemId', 'effectiveDate'])
export class PurchasePrice {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column('uuid') itemId: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, transformer: decimalColumn }) price: string;
  @Column({ type: 'numeric', precision: 18, scale: 4, transformer: decimalColumn })
  purchaseQuantity: string;
  @Column() purchaseUnit: string;
  @Column({ type: 'date' }) effectiveDate: string;
  @CreateDateColumn() createdAt: Date;
}
