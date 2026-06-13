import { Module } from '@nestjs/common';
import { RequirementsService } from './requirements.service.js';
import { RequirementsController } from './requirements.controller.js';

@Module({
  controllers: [RequirementsController],
  providers: [RequirementsService],
  exports: [RequirementsService],
})
export class RequirementsModule {}
