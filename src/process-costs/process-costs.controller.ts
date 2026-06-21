import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ProcessCostsService } from './process-costs.service';
import { CreateProcessCostDto } from './dto/create-process-cost.dto';

@Controller()
export class ProcessCostsController {
  constructor(private readonly service: ProcessCostsService) {}
  @Post('items/:id/process-costs')
  create(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateProcessCostDto) { return this.service.create(id, dto); }
  @Get('items/:id/process-costs')
  list(@Param('id', ParseUUIDPipe) id: string) { return this.service.list(id); }
  @Delete('process-costs/:id')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.service.remove(id); }
}
