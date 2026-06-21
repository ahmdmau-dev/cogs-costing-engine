import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppDataSource } from './data-source';
import { ItemsModule } from './items/items.module';

@Module({
  imports: [TypeOrmModule.forRoot({ ...AppDataSource.options, autoLoadEntities: true }), ItemsModule],
})
export class AppModule {}
