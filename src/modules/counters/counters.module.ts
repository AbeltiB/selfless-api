import { Module } from '@nestjs/common';
import { CountersService } from './counters.service.js';
import { CountersController } from './counters.controller.js';

@Module({
  controllers: [CountersController],
  providers: [CountersService],
  exports: [CountersService],
})
export class CountersModule {}
