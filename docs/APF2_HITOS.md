# Hoja de ruta — APF2 (12 hitos)

El producto busca un primer despliegue verificable, no la totalidad del currículo. El estado **pendiente de prueba local** implica que la base de datos del equipo todavía no ha sido validada.

| Nº | Hito | Estado |
|---|---|---|
| 1 | Alinear arquitectura, README, entorno MySQL/MariaDB y Plesk | Completado |
| 2 | Modelo físico de BD, SQL, seed, relaciones e índices | Pruebas locales superadas en MySQL 8.0.39; MariaDB pendiente |
| 3 | Backend NestJS, Prisma, configuración y health check | Implementado; pendiente de baseline y prueba en MySQL local |
| 4 | Repository Pattern y diagrama de clases | Pendiente |
| 5 | Login, JWT, roles y permisos | Pendiente |
| 6 | APIs reales: alumnos, salones, proyectos, workspaces, progreso | Pendiente |
| 7 | Conectar frontend actual con backend y reemplazar mocks esenciales | Pendiente |
| 8 | Persistir editor React Flow y resultados de entrenamiento pedagógico | Pendiente |
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
