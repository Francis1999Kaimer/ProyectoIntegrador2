import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnvironment } from './config/environment';
import { PrismaModule } from './prisma/prisma.module';
import { RepositoriesModule } from './repositories/repositories.module';
import { ProjectsModule } from './projects/projects.module';
import { HealthModule } from './health/health.module';
@Module({ imports: [ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }), PrismaModule, HealthModule, RepositoriesModule, ProjectsModule] })
export class AppModule {}
