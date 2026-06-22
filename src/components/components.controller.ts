import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ComponentsService } from './components.service';
import { CreateComponentDto } from './dto/create-component.dto';

@Controller()
export class ComponentsController {
  constructor(private readonly service: ComponentsService) {}
  @Post('items/:id/components')
  create(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreateComponentDto) { return this.service.create(id, dto); }
  @Get('items/:id/components')
  list(@Param('id', ParseUUIDPipe) id: string) { return this.service.findForParent(id); }
  @Delete('components/:id')
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.service.remove(id); }
}
