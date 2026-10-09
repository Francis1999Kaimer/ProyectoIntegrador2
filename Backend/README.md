# Backend — AI Blocks Studio (APF2 hito 3)

API NestJS 11 + TypeScript + Prisma 6.19 (versión fijada para este hito).
Requiere Node 22.12+ (línea 22) o Node 24. Ejecutar desde `Backend/`.
El único endpoint de esta entrega es `GET /health`: HTTP 200 si MySQL responde a SELECT 1,
HTTP 503 si pierde conexión durante la ejecución. Si la conexión inicial falla, la API no inicia.
Login, repositorios y APIs de negocio pertenecen a los hitos 4–6.

## Preparación y pruebas en Windows

Primero actualizar; no volver a importar schema/seed sobre la BD ya instalada:

```powershell
cd C:\Users\franc\Escritorio\ProyectoIntegrador2
git pull origin main
node --version
npm --version
cd Backend
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
notepad .env
```

En `.env`, reemplaza REPLACE_ME por tu contraseña local y conserva
`127.0.0.1:3306/aiblockstudio`. No compartas el archivo ni lo subas a GitHub.
Si la contraseña contiene caracteres especiales, codifícala para una URL.
Cerrar y guardar el archivo antes de continuar. La API usa únicamente Backend/.env.

```powershell
npm run prisma:validate
npm run prisma:generate
npm run build
npm test
npx prisma db pull --print
npm run prisma:baseline
npm run prisma:status
npm run start:dev
```

Detenerse ante errores. `db pull --print` introspecta sin modificar el modelo versionado.
Es normal que Prisma advierta que no representa CHECK. No ejecutar `db push` ni `migrate reset`.
Después del baseline se esperan 18 tablas: las 17 del producto más `_prisma_migrations`.
La verificación del hito 2 cuenta todas las tablas y dará 18 tras registrar Prisma;
ese cambio no significa que se haya perdido una tabla.

En otra ventana PowerShell:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/health
```

Esperado: `status: ok`, `database: up`.
Ctrl+C detiene la API. Producción: `npm run build`, `npm start`.
El HOST predeterminado es 127.0.0.1; la configuración de Plesk se hará en el hito 12.

## Baseline y evolución

La migración `prisma/migrations/0_init/migration.sql` conserva exactamente el esquema del
hito 2, incluyendo CHECK, JSON_VALID, collations y ON UPDATE CURRENT_TIMESTAMP.
`npm run prisma:baseline` comprueba tablas, columnas/tipos/nulabilidad, FK, nombres de CHECK,
índices y el diff de Prisma antes de registrar 0_init como aplicado. Solo escribe el historial
de Prisma: no ejecuta el SQL inicial ni cambia los datos de aplicación. Si encuentra diferencias
se detiene. Puede repetirse: detecta si 0_init ya fue registrado.

La comprobación de nombres CHECK no demuestra equivalencia de sus expresiones; conservar el SQL
original y revisar SHOW CREATE TABLE si se modificó manualmente alguna restricción.
Para cambios futuros: crear migración revisable, verificar que conserve las restricciones SQL
que Prisma no representa y probarla primero en una BD de prueba. No editar 0_init después de aplicarlo.
Usar `npm run prisma:deploy` solo para migraciones revisadas. Una BD vacía puede instalar el esquema
con migrate deploy; el seed curricular sigue siendo `database/seed.sql` y se importa separadamente.
No ejecutar baseline sobre una BD vacía.

Referencia: https://www.prisma.io/docs/orm/v6/prisma-migrate/workflows/baselining

## Evidencia requerida para cerrar hito 3

Compartir la salida de validate, generate, build, test, baseline, status y /health, sin .env.
La compilación y las pruebas con dobles de BD no sustituyen la conexión a tu MySQL 8.0.39.
Validación MariaDB/Plesk permanece pendiente.
