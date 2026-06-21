import { BadRequestException, Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CostingService } from './costing.service';
import { PreviewDto } from './dto/preview.dto';
import { CircularReferenceError, ItemNotFoundError, MissingPriceError } from './costing.gateway';

@Controller()
export class CostingController {
  constructor(private readonly service: CostingService) {}

  @Get('items/:id/cost')
  async cost(@Param('id', ParseUUIDPipe) id: string) {
    try {
      return await this.service.computeCost(id);
    } catch (e) {
      this.translate(e);
    }
  }

  @Post('cost/preview')
  async preview(@Body() dto: PreviewDto) {
    try {
      return await this.service.previewPriceChange(dto);
    } catch (e) {
      this.translate(e);
    }
  }

  private translate(e: unknown): never {
    if (e instanceof ItemNotFoundError) throw new NotFoundException(e.message);
    if (e instanceof CircularReferenceError || e instanceof MissingPriceError) throw new BadRequestException(e.message);
    throw e;
  }
}
