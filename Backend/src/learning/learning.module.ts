import { Module } from '@nestjs/common';
import { PasswordService } from '../auth/password.service';
import { RepositoriesModule } from '../repositories/repositories.module';
import { LearningController } from './learning.controller';
import { LearningService } from './learning.service';
@Module({ imports: [RepositoriesModule], controllers: [LearningController], providers: [LearningService, PasswordService] })
export class LearningModule {}
