import { Module } from '@nestjs/common';
import { LearningModule } from '../learning/learning.module';
import { AssignmentsController } from './assignments.controller';
import { AssignmentsService } from './assignments.service';
@Module({ imports: [LearningModule], controllers: [AssignmentsController], providers: [AssignmentsService] })
export class AssignmentsModule {}
