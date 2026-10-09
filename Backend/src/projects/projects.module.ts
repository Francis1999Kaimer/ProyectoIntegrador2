import { Module } from '@nestjs/common';
import { RepositoriesModule } from '../repositories/repositories.module';
import { ProjectService } from './project.service';
@Module({ imports: [RepositoriesModule], providers: [ProjectService], exports: [ProjectService] })
export class ProjectsModule {}
