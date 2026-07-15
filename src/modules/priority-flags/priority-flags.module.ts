import { Module } from '@nestjs/common';
import { PriorityFlagsController } from './priority-flags.controller.js';
import { PriorityFlagsService } from './priority-flags.service.js';

@Module({
  controllers: [PriorityFlagsController],
  providers: [PriorityFlagsService],
  exports: [PriorityFlagsService],
})
export class PriorityFlagsModule {}
