import { Module } from '@nestjs/common';
import { LearningModule } from '../learning/learning.module';
import { TrainingController } from './training.controller';
import { TrainingService } from './training.service';
@Module({ imports: [LearningModule], controllers: [TrainingController], providers: [TrainingService] })
export class TrainingModule {}
