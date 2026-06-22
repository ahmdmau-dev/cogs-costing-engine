import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { UnitsService } from './units.service';
import { CreateConversionDto } from './dto/create-conversion.dto';

@Controller()
export class UnitsController {
  constructor(private readonly service: UnitsService) {}
  @Post('unit-conversions') create(@Body() dto: CreateConversionDto) { return this.service.create(dto); }
  @Get('unit-conversions') listGlobal() { return this.service.listGlobal(); }
  @Get('items/:id/conversions') listForItem(@Param('id', ParseUUIDPipe) id: string) { return this.service.listForItem(id); }
  @Delete('unit-conversions/:id') remove(@Param('id', ParseUUIDPipe) id: string) { return this.service.remove(id); }
}
