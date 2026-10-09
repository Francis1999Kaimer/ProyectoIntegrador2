import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import * as C from './contracts';
import * as P from './prisma.repositories';
const bindings = [
  { provide: C.USER_REPOSITORY, useClass: P.PrismaUserRepository },
  { provide: C.PROJECT_REPOSITORY, useClass: P.PrismaProjectRepository },
  { provide: C.WORKSPACE_REPOSITORY, useClass: P.PrismaWorkspaceRepository },
  { provide: C.CLASSROOM_REPOSITORY, useClass: P.PrismaClassroomRepository },
  { provide: C.PROGRESS_REPOSITORY, useClass: P.PrismaProgressRepository },
  { provide: C.SIMULATION_RUN_REPOSITORY, useClass: P.PrismaSimulationRunRepository }
];
@Module({ imports: [PrismaModule], providers: bindings, exports: bindings.map(b => b.provide) })
export class RepositoriesModule {}
