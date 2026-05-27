import { Module } from '@nestjs/common';
import { FormsService } from './forms.service.js';

@Module({ providers: [FormsService], exports: [FormsService] })
export class FormsModule {}
