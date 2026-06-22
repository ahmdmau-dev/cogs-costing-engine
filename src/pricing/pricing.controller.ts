import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { CreatePriceDto } from './dto/create-price.dto';

@Controller('items/:id/prices')
export class PricingController {
  constructor(private readonly service: PricingService) {}
  @Post() create(@Param('id', ParseUUIDPipe) id: string, @Body() dto: CreatePriceDto) { return this.service.create(id, dto); }
  @Get() history(@Param('id', ParseUUIDPipe) id: string) { return this.service.history(id); }
}
