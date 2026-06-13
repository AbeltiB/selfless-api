import { Module } from '@nestjs/common';
import { FormsService } from './forms.service.js';
import { FormsController } from './forms.controller.js';

@Module({
  controllers: [FormsController],
  providers: [FormsService],
  exports: [FormsService],
})
export class FormsModule {}
