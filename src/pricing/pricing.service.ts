import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PurchasePrice } from './purchase-price.entity';
import { Item, ItemType } from '../items/item.entity';
import { CreatePriceDto } from './dto/create-price.dto';

@Injectable()
export class PricingService {
  constructor(
    @InjectRepository(PurchasePrice) private readonly repo: Repository<PurchasePrice>,
    @InjectRepository(Item) private readonly items: Repository<Item>,
  ) {}
  async create(itemId: string, dto: CreatePriceDto) {
    const item = await this.items.findOne({ where: { id: itemId } });
    if (!item) throw new NotFoundException(`Item ${itemId} not found`);
    if (item.type !== ItemType.PURCHASED) throw new BadRequestException('Prices can only be added to PURCHASED items');
    return this.repo.save(this.repo.create({ itemId, ...dto }));
  }
  history(itemId: string) {
    return this.repo.find({ where: { itemId }, order: { effectiveDate: 'DESC', createdAt: 'DESC' } });
  }
}
