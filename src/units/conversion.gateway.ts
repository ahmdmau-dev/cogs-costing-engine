export interface ConversionEdge {
  itemId: string | null; // null = global
  fromUnit: string;
  toUnit: string;
  factor: string; // 1 fromUnit = factor toUnit
}

export interface ConversionGateway {
  // All edges relevant to an item: its own + global. Order irrelevant.
  getEdges(itemId: string | null): Promise<ConversionEdge[]>;
}

export const CONVERSION_GATEWAY = Symbol('CONVERSION_GATEWAY');

import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UnitConversion } from './unit-conversion.entity';

@Injectable()
export class TypeOrmConversionGateway implements ConversionGateway {
  constructor(@InjectRepository(UnitConversion) private readonly repo: Repository<UnitConversion>) {}
  async getEdges(itemId: string | null): Promise<ConversionEdge[]> {
    const rows = await this.repo
      .createQueryBuilder('c')
      .where('c.itemId IS NULL')
      .orWhere(itemId ? 'c.itemId = :itemId' : '1 = 0', { itemId })
      .getMany();
    return rows.map((r) => ({ itemId: r.itemId, fromUnit: r.fromUnit, toUnit: r.toUnit, factor: r.factor }));
  }
}
