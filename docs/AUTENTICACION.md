# Autenticación y autorización — APF2 hito 5

Login por username y contraseña contra users mediante UserRepository.
Bcryptjs genera hashes con salt aleatoria y coste 12; se rechazan contraseñas nuevas
de menos de 12 caracteres o más de 72 bytes UTF-8, evitando truncamiento de bcrypt.
Nunca se devuelve password_hash desde la API.

## Endpoints

| Método y ruta | Acceso | Resultado |
|---|---|---|
| GET /health | Público | Estado de BD |
| POST /auth/login | Público, 10 intentos/min por IP y ruta | JWT y perfil sin hash |
| GET /auth/me | Bearer válido | Perfil actual desde BD |
| POST /auth/change-password | Bearer válido, 5 intentos/min por IP y ruta | Verifica contraseña actual, actualiza hash e invalida JWT previos |
| GET /auth/access/admin | admin | Prueba de permiso APF2 |
| GET /auth/access/teacher | teacher o admin | Prueba de permiso APF2 |
| GET /auth/access/student | student o admin | Prueba de permiso APF2 |

Las rutas access son comprobaciones de autorización para la sustentación.
Los endpoints de proyectos/salones y la pantalla de login se implementarán en hitos 6–7.
No hay registro público ni se permite elegir rol mediante el cuerpo del login.

JWT HS256: duración 15 minutos, issuer aiblocks-api, audience aiblocks-web.
Los Guards son globales; rutas futuras requieren token salvo @Public explícito.
La autorización usa rol y estado de BD, no confía en un rol recibido del cliente.
Una cuenta pending/suspended, eliminada o con rol desconocido no puede autenticarse.
must_change_password bloquea rutas de negocio; permite me y change-password.
Se rechazan parámetros no declarados y se validan DTO con ValidationPipe.

Cada JWT contiene una huella HMAC del hash de contraseña, sin revelar el hash.
Cambiar la contraseña cambia la huella y rechaza tokens anteriores sin migración SQL.
No hay refresh token ni logout con revocación por sesión en esta entrega: el cliente
descarta su token al salir y vuelve a iniciar sesión cuando vence. La suspensión se
comprueba en cada petición. El limitador usa memoria del proceso; se revisará almacenamiento
compartido y trust proxy en despliegue Plesk. No se habilita trust proxy indiscriminadamente.

## Preparar y probar en Windows

Detener la API con Ctrl+C. Actualizar primero:

```powershell
cd C:\Users\franc\Escritorio\ProyectoIntegrador2
git pull origin main
cd Backend
npm ci
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
notepad .env
```

Agregar una sola línea JWT_SECRET con el valor aleatorio generado (64 caracteres hex),
sin cambiar DATABASE_URL ni las demás variables. El secreto no debe compartirse, copiarse
al informe ni subirse a GitHub. La API rechaza secretos ausentes/cortos/de ejemplo.
Si cambias JWT_SECRET posteriormente, los JWT anteriores dejarán de ser válidos.

```powershell
npm test
npm run auth:seed-demo
npm run prisma:status
npm run start:dev
```

npm test ahora regenera Prisma, compila y ejecuta pruebas automáticamente, deteniéndose
si falla la compilación. npm run build también regenera Prisma antes de compilar.
No reimportar SQL ni repetir baseline: no hay cambios estructurales de BD.

auth:seed-demo pide una contraseña enmascarada de mínimo 12 caracteres y crea **solo**
tres cuentas sintéticas locales:

| Usuario | Rol |
|---|---|
| aiblocks_demo_student | student |
| aiblocks_demo_teacher | teacher |
| aiblocks_demo_admin | admin |

Esta contraseña es para entrar a la aplicación; es distinta de la contraseña de MySQL.
Conservarla para la prueba siguiente. No existen contraseñas demo fijas publicadas.
El helper PowerShell entrega la contraseña a Node en el entorno temporal y restaura
la variable anterior al terminar; no guarda el texto en archivos ni lo imprime.
El script se limita a NODE_ENV=development y servidores localhost. Usa transacción;
si una cuenta existente no coincide, falla sin sobrescribirla. Puede repetirse con
la misma contraseña; no crea duplicados ni resetea credenciales.
Las cuentas son ficticias, sin emails ni datos de menores reales; no representan matrícula
o consentimiento. Altas reales y reglas de consentimiento se implementarán con hito 6.

En otra ventana PowerShell:

```powershell
cd C:\Users\franc\Escritorio\ProyectoIntegrador2\Backend
npm run auth:test-demo
Invoke-RestMethod http://127.0.0.1:3000/health
```

Introducir la misma contraseña demo cuando se solicite. Se esperan PASS para:
sin token 401, contraseña incorrecta 401, tres logins/perfiles, matriz de permisos
200/403 y token inválido 401. El script no imprime tokens ni modifica registros.
Si aparece 429 tras repetir las pruebas, esperar un minuto antes de reintentar.
En Linux, los scripts Node pueden ejecutarse directamente con DEMO_PASSWORD configurado
en el entorno y después eliminado; el helper PowerShell es para Windows.

## Evidencia y límites

Los tests HTTP usan la aplicación NestJS con doble de repositorio/Prisma, sin acceder
a la BD del usuario. Prueban el pipeline real: DTO, Guards, bcrypt, JWT, estado/rol
actual, cambio de contraseña, invalidación y rate limiting. auth:test-demo debe ejecutarse
en el PC para comprobar login y roles con los hashes almacenados en MySQL real.
El cambio de contraseña persistido y las autorizaciones por propietario/matrícula
se ampliarán en las pruebas de integración de APIs.

Compartir solo resultados PASS, cantidad de tests, estado Prisma y health. No enviar
.env, tokens, contraseñas o hashes. HTTPS, Helmet, auditoría, catálogo de controles,
ZAP y evaluación global de seguridad pertenecen al hito 9 y al despliegue.

Referencias de implementación:
- https://github.com/nestjs/jwt
- https://github.com/nestjs/throttler
- https://github.com/dcodeIO/bcrypt.js

## Evidencia de hitos anteriores

El usuario validó hito 4 en MySQL el 9 de octubre de 2026: generación Prisma, build,
11 tests, seis repositorios consultando tablas, inicio NestJS y health ok/up.

## Dependencias y auditoría

Se actualiza NestJS dentro de la rama 11 (11.2.7) y @nestjs/config a 4.0.4,
con lockfile versionado y pruebas repetidas. npm audit reduce 12 alertas a 4 altas
en la cadena de Prisma y dependencias @prisma/config, deepmerge-ts y effect.
npm audit --omit=dev también reporta esas cuatro en el árbol instalado; no se afirma
que producción esté libre de alertas. La evaluación y corrección de esa cadena siguen
pendientes para hito 9; no se fuerza downgrade ni migración mayor de Prisma.
