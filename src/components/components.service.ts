import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ItemComponent } from './item-component.entity';
import { Item, ItemType } from '../items/item.entity';
import { CreateComponentDto } from './dto/create-component.dto';
import { wouldCreateCycle } from './cycle.util';

@Injectable()
export class ComponentsService {
  constructor(
    @InjectRepository(ItemComponent) private readonly repo: Repository<ItemComponent>,
    @InjectRepository(Item) private readonly items: Repository<Item>,
  ) {}

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
    const parent = await this.items.findOne({ where: { id: parentItemId } });
    if (!parent) throw new NotFoundException(`Item ${parentItemId} not found`);
    if (parent.type !== ItemType.PRODUCED) throw new BadRequestException('Components can only be added to PRODUCED items');
    const componentItem = await this.items.findOne({ where: { id: dto.componentItemId } });
    if (!componentItem) throw new NotFoundException(`Item ${dto.componentItemId} not found`);
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
