# Hoja de ruta — APF2 (12 hitos)

El producto busca un primer despliegue verificable, no la totalidad del currículo. El estado **pendiente de prueba local** implica que la base de datos del equipo todavía no ha sido validada.

| Nº | Hito | Estado |
|---|---|---|
| 1 | Alinear arquitectura, README, entorno MySQL/MariaDB y Plesk | Completado |
| 2 | Modelo físico de BD, SQL, seed, relaciones e índices | Pruebas locales superadas en MySQL 8.0.39; MariaDB pendiente |
| 3 | Backend NestJS, Prisma, configuración y health check | Pruebas locales superadas: baseline 0_init, estado actualizado y health ok/up |
| 4 | Repository Pattern y diagrama de clases | Pruebas locales superadas: 11 tests, seis repositorios en MySQL y health ok/up |
| 5 | Login, JWT, roles y permisos | Pruebas locales superadas: 19 tests, tres roles, JWT rechazados y health ok/up |
| 6 | APIs reales: alumnos, salones, proyectos, workspaces, progreso | Pruebas locales superadas con MySQL: escrituras, permisos, concurrencia y revocación |
| 7 | Conectar frontend actual con backend y reemplazar mocks esenciales | Implementado; pruebas UI/compilación superadas y administración de alumnos, docentes, salones, matrículas, proyectos y lecciones conectada |
| 8 | Persistir editor React Flow y resultados de entrenamiento pedagógico | Implementado; pruebas de API, UI y compilación superadas, pendiente de demostración manual local |
| 9 | Validaciones, controles de seguridad y auditoría | Pendiente |
| 10 | Documentación APF2: BD, replicación, cifrado, pruebas y despliegue | Pendiente |
| 11 | Pruebas unitarias/integración/seguridad con evidencias | Pendiente |
| 12 | Despliegue Plesk + MariaDB y validación en cloud | Pendiente |

## Requisitos transversales

- Levantar el **100 % de las observaciones APF1** aportadas por el profesor.
- Mantener frontend funcional y evitar cambios abruptos.
- No incluir secretos ni contraseñas en GitHub.
- Mantener siempre sincronizados SQL, modelo físico y documentación.
- No afirmar replicación, backups, despliegue ni ejecuciones de MySQL sin evidencias reales.
- Para cada prueba que deba ejecutarse en Windows, indicar primero `git pull origin main` y después los comandos correspondientes.

## Hito 2

Se añade `database/schema.sql`, `database/seed.sql`, `database/verify.sql`, `database/check_model.py`, `database/README.md` y `docs/DER.md`. Se preserva el frontend. Los comandos de prueba en la computadora figuran en `database/README.md`. El diseño queda definido, pero su aceptación final depende de importar y verificar el SQL en MySQL y luego repetir en MariaDB de Plesk.

## Hito 3

Backend ejecutable con configuración validada, CORS explícito, PrismaService y GET /health.
17 modelos Prisma elaborados desde el SQL del hito 2; introspección y comparación contra
la BD real deben ejecutarse en el PC. Migración inicial 0_init copia el SQL original;
el comando de baseline comprueba estructura e historial antes de marcarla como aplicada.
No recrea tablas ni reimporta el seed. Pruebas unitarias para configuración, health y
rechazo de esquemas incompatibles. Pipeline de compilación y validación sin BD real.

Prueba local: seguir [Backend/README.md](../Backend/README.md), comenzando por
git pull origin main. Los PASS del hito 2 fueron aportados por el usuario el 9 de octubre
de 2026: MySQL 8.0.39, 17 tablas, 24 FK, 3 niveles, 24 semanas y 3 clases/retos piloto.
Después del baseline hay una tabla técnica adicional _prisma_migrations.
La visualización de tildes en la terminal queda pendiente de comprobar con cliente UTF-8.

## Hito 4

Seis contratos sin dependencia de Prisma, seis implementaciones Prisma, tokens Symbol,
RepositoriesModule, ProjectsModule y ProjectService. Documentación y diagrama:
[REPOSITORY_PATTERN.md](REPOSITORY_PATTERN.md). Las lecturas son paginadas y filtradas;
los datos públicos de usuario excluyen password_hash. Pruebas de sustitución del repositorio
en NestJS, límites, filtros y proyecciones. La prueba real de solo lectura
npm run test:repositories:db debe ejecutarse en el PC después de git pull origin main.

Aceptación del hito 3: evidencia del usuario del 9 de octubre de 2026 confirma introspección,
baseline aplicado sin recrear tablas, Database schema is up to date y GET /health ok/up.
Mantener pendiente la revisión de vulnerabilidades reportadas por npm ci.

## Hito 5

Login contra users con bcrypt, JWT HS256 de 15 minutos, Guards globales, roles desde BD,
validación DTO, límites de login/cambio de contraseña y cambio que invalida JWT previos.
Cuentas demo creadas explícitamente en el PC con contraseña elegida localmente; sin claves
fijas ni migraciones de esquema. Endpoints y comandos en [AUTENTICACION.md](AUTENTICACION.md).

Se corrige el flujo de generación Prisma: prebuild regenera el cliente, pretest compila,
y TypeScript no emite si hay errores. Hito 4 validado por el usuario el 9 de octubre de 2026:
build, 11 tests, seis repositorios consultando MySQL, NestJS y health ok/up.

Auditoría de dependencias en hito 5: actualizaciones compatibles de NestJS reducen
12 alertas a 4 en la cadena de Prisma; npm audit --omit=dev también reporta esas cuatro.
Las alertas se mantienen pendientes de evaluación en hito 9.


## Hito 6

APIs protegidas para alumnos (alta pendiente, estado y consentimiento), salones y matrículas,
proyectos por propietario, workspaces con versión/snapshot atómicos, lecciones por curso/nivel
y progreso calculado y monotónico. LearningRepository amplía las operaciones transaccionales
sin introducir Prisma en servicio/controlador/contrato. No cambia SQL ni frontend.
Contrato y prueba HTTP con escrituras sintéticas y verificación independiente de MySQL en
[APIS_HITO6.md](APIS_HITO6.md). Pruebas locales MySQL superadas el 9 de octubre de 2026; MariaDB/Plesk continúa pendiente.

Aceptación del hito 5: evidencia del usuario del 9 de octubre de 2026: 19 tests pasan,
cuentas demo disponibles, tres logins/perfiles/permisos, credenciales/tokens inválidos 401
y GET /health ok/up. Reseteo de las claves demo confirmado en MySQL local; no se publican.


## Hito 7

El frontend React conserva el diseño y consume la API NestJS mediante un cliente HTTP tipado.
Incluye sesión en `sessionStorage`, rutas protegidas, redirección por rol/cambio de clave,
proyectos, salones, matrícula, lecciones, progreso y administración de alumnos y docentes.
El administrador selecciona al docente responsable al crear un salón y la matrícula usa
selectores de alumnos elegibles, sin UUIDs manuales. Los mocks
esenciales fueron reemplazados en esos recorridos; dataset, preparación, modelo, editor y
entrenamiento siguen declarados como experiencia educativa hasta el hito 8.

Las pruebas automatizadas verifican el cliente y los flujos React, incluidas rutas profundas,
validación, roles, 401, cambio de contraseña, contenido escapado y solicitudes concurrentes.
El bundle también se compila. Para la demostración real contra la API y MySQL local, seguir
[FRONTEND_HITO7.md](FRONTEND_HITO7.md), empezando por `git pull origin main`.

Aceptación del hito 6: evidencia del usuario del 9 de octubre de 2026 confirma el script
`apis-smoke.cjs` contra MySQL real: alumno/consentimiento/activación, salón/matrícula,
proyecto y snapshots concurrentes, progreso y revocación; GET `/health` devolvió `ok/up`.

## Hito 8

El producto se centra en un único tipo de proyecto: reconocimiento de caracteres individuales.
El usuario carga un ZIP etiquetado, entrena una CNN real con TensorFlow.js en el navegador,
evalúa accuracy/loss y prueba una imagen nueva. Dataset, métricas y modelo quedan en IndexedDB
del navegador; el backend conserva el proyecto, permisos y solo permite crear
`character_recognition`. El alcance y formato del dataset están en
[HITO8_RECONOCIMIENTO_CARACTERES.md](HITO8_RECONOCIMIENTO_CARACTERES.md).
