require('reflect-metadata');
require('dotenv').config();
const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const C = require('../dist/repositories/contracts');
const { ProjectService } = require('../dist/projects/project.service');
const NIL = '00000000-0000-0000-0000-000000000000';

async function main() {
  // No HTTP server, no writes, no credentials or personal records printed.
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false, abortOnError: false });
  try {
    await app.get(C.USER_REPOSITORY).findById(NIL);
    console.log('PASS: UserRepository consulta users.');
    await app.get(ProjectService).listForOwner(NIL, { limit: 1 });
    console.log('PASS: ProjectService -> ProjectRepository consulta projects.');
    await app.get(C.WORKSPACE_REPOSITORY).findByProject(NIL);
    console.log('PASS: WorkspaceRepository consulta workspaces.');
    await app.get(C.CLASSROOM_REPOSITORY).listByTeacher(NIL, { limit: 1 });
    console.log('PASS: ClassroomRepository consulta classrooms.');
    await app.get(C.PROGRESS_REPOSITORY).listByStudent(NIL, { limit: 1 });
    console.log('PASS: ProgressRepository consulta lesson_progress.');
    await app.get(C.SIMULATION_RUN_REPOSITORY).listByWorkspace(NIL, { limit: 1 });
    console.log('PASS: SimulationRunRepository consulta simulation_runs.');
    console.log('PASS: seis repositorios resueltos por NestJS y consultados en MySQL; prueba de solo lectura.');
  } finally { await app.close(); }
}
main().catch(() => {
  console.error('FAIL: revisa Backend/.env, conexión, esquema y npm run build. No se modificaron datos por esta prueba.');
  process.exitCode = 1;
});
