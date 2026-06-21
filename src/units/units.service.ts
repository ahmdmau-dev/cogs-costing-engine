import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { UnitConversion } from './unit-conversion.entity';
import { CreateConversionDto } from './dto/create-conversion.dto';

@Injectable()
export class UnitsService {
  constructor(@InjectRepository(UnitConversion) private readonly repo: Repository<UnitConversion>) {}
  create(dto: CreateConversionDto) {
    return this.repo.save(this.repo.create({ itemId: dto.itemId ?? null, fromUnit: dto.fromUnit, toUnit: dto.toUnit, factor: dto.factor }));
  }
  listGlobal() { return this.repo.find({ where: { itemId: IsNull() } }); }
  listForItem(itemId: string) { return this.repo.find({ where: { itemId } }); }
  async remove(id: string) {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException(`Conversion ${id} not found`);
    await this.repo.delete(id);
    return { deleted: true };
  }
}
