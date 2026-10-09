import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/environment';
import { PrismaModule } from './prisma/prisma.module';
import { RepositoriesModule } from './repositories/repositories.module';
import { ProjectsModule } from './projects/projects.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { LearningModule } from './learning/learning.module';
@Module({ imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }), PrismaModule, HealthModule, RepositoriesModule, ProjectsModule, AuthModule, LearningModule] })
export class AppModule {}
