import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ItemComponent } from './item-component.entity';
import { ComponentsService } from './components.service';
import { ComponentsController } from './components.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ItemComponent])],
  controllers: [ComponentsController],
  providers: [ComponentsService],
})
export class ComponentsModule {}
