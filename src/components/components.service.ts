import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ItemComponent } from './item-component.entity';
import { CreateComponentDto } from './dto/create-component.dto';
import { wouldCreateCycle } from './cycle.util';

@Injectable()
export class ComponentsService {
  constructor(@InjectRepository(ItemComponent) private readonly repo: Repository<ItemComponent>) {}

  private ancestorsOf = async (id: string): Promise<string[]> => {
    const result = new Set<string>();
    const visit = async (target: string) => {
      const parents = await this.repo.find({ where: { componentItemId: target } });
      for (const p of parents) {
        if (!result.has(p.parentItemId)) {
          result.add(p.parentItemId);
          await visit(p.parentItemId);
        }
      }
    };
    await visit(id);
    return [...result];
  };

  async create(parentItemId: string, dto: CreateComponentDto) {
    if (await wouldCreateCycle(parentItemId, dto.componentItemId, this.ancestorsOf)) {
      throw new BadRequestException('This component would create a circular reference');
    }
    return this.repo.save(
      this.repo.create({
        parentItemId,
        componentItemId: dto.componentItemId,
        quantity: dto.quantity,
        unit: dto.unit,
        wasteFactor: dto.wasteFactor ?? '1',
      }),
    );
  }
  findForParent(parentItemId: string) {
    return this.repo.find({ where: { parentItemId } });
  }
  async remove(id: string) {
    const found = await this.repo.findOne({ where: { id } });
    if (!found) throw new NotFoundException(`Component ${id} not found`);
    await this.repo.delete(id);
    return { deleted: true };
  }
}
