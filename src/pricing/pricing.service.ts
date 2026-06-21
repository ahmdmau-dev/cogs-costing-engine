import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PurchasePrice } from './purchase-price.entity';
import { CreatePriceDto } from './dto/create-price.dto';

@Injectable()
export class PricingService {
  constructor(@InjectRepository(PurchasePrice) private readonly repo: Repository<PurchasePrice>) {}
  create(itemId: string, dto: CreatePriceDto) {
    return this.repo.save(this.repo.create({ itemId, ...dto }));
  }
  history(itemId: string) {
    return this.repo.find({ where: { itemId }, order: { effectiveDate: 'DESC', createdAt: 'DESC' } });
  }
}
