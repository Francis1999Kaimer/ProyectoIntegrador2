# Backend — AI Blocks Studio

**Estado:** pendiente de implementación (hito 3 de APF2). Esta carpeta no contiene todavía una API ejecutable.

## Stack objetivo

- NestJS + TypeScript.
- Prisma ORM con proveedor `mysql` (compatible con MySQL local y MariaDB objetivo, sujeto a pruebas de versión).
- Repository Pattern: Controller → Service → Repository Interface → Prisma Repository.
- JWT, hash de contraseñas, Guards por rol, validación, rate limiting y logs de auditoría.
- BD de desarrollo: `aiblockstudio` en `127.0.0.1:3306`.
- BD de producción: MariaDB administrada desde Plesk.

## Endpoints previstos APF2

- Autenticación y sesión por rol.
- Gestión mínima de salones, alumnos y proyectos.
- Guardar y recuperar workspaces del editor de bloques.
- Progreso y ejecuciones pedagógicas (resultados persistidos).
- `/health` para pruebas y monitoreo.

No incluir credenciales en el código ni subir archivos `.env`. Ver plantilla raíz `.env.example`, decisiones `docs/DECISIONES.md` y cronograma `docs/APF2_HITOS.md`.

Redis, MinIO y el ML-Service Python quedan diferidos; no son dependencias del flujo básico de APF2.
