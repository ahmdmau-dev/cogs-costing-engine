import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ProcessCost } from './process-cost.entity';
import { CreateProcessCostDto } from './dto/create-process-cost.dto';

@Injectable()
export class ProcessCostsService {
  constructor(@InjectRepository(ProcessCost) private readonly repo: Repository<ProcessCost>) {}
  create(itemId: string, dto: CreateProcessCostDto) {
    return this.repo.save(this.repo.create({ itemId, ...dto }));
  }
  list(itemId: string) { return this.repo.find({ where: { itemId } }); }
  async remove(id: string) {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException(`Process cost ${id} not found`);
    await this.repo.delete(id);
    return { deleted: true };
  }
}
