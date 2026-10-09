# APIs funcionales — APF2 hito 6

Todas las rutas requieren Bearer JWT válido, cuenta activa y cambio de contraseña inicial
completado. Las rutas de auth/health mantienen sus excepciones del hito 5. Las respuestas
excluyen hashes, contraseñas y datos de contacto de tutores. Listas: limit 1–100 (25 por
omisión), offset 0–1 000 000 (0 por omisión), orden estable; devuelven arrays. No hay total
ni paginación por cursor en esta entrega. UUID v4 para identificadores. Campos adicionales,
null en campos opcionales, texto vacío y PATCH vacío se rechazan con 400.

## Contrato HTTP

| Método y ruta | Acceso y resultado |
|---|---|
| GET /catalog | Todos los roles: hasta 100 niveles y 100 cursos publicados |
| GET /students | admin: alumnos; teacher: solo alumnos matriculados en sus salones |
| POST /students | admin: crea alumno pending, bcrypt coste 12, must_change_password=true |
| PATCH /students/:id/status | admin: pending/active/suspended; activar exige consentimiento vigente |
| POST /students/:id/consents | admin: registra nueva evidencia, sin devolver nombre/contacto del tutor |
| DELETE /students/:id/consents/current | admin: revoca consentimientos vigentes y suspende al alumno (204) |
| GET /classrooms | admin: todos; teacher: propios; student: matriculados |
| GET /classrooms/:id | Misma autorización por salón |
| POST /classrooms | teacher: se asigna a sí mismo; admin: debe indicar teacher_id activo |
| PATCH /classrooms/:id | Docente del salón/admin: nombre, escuela o estado active/archived |
| GET /classrooms/:id/students | Docente del salón/admin: id, username, display_name y status |
| POST /classrooms/:id/students | Docente del salón/admin: matrícula idempotente (200) |
| DELETE /classrooms/:id/students/:studentId | Docente del salón/admin: retira matrícula (204) |
| GET /classrooms/:id/lessons | Acceso al salón; lecciones publicadas de su curso/nivel, salón activo |
| GET /projects | student: propios; teacher: propios y de sus salones; admin: todos |
| POST /projects | Todos: owner_id tomado del JWT; salón opcional debe ser accesible y activo |
| GET /projects/:id | Propietario, docente del salón o admin |
| PATCH /projects/:id | Solo propietario: title y status; sin transferir dueño/salón |
| GET /projects/:id/workspace | Misma lectura autorizada del proyecto; 404 si aún no existe |
| PUT /projects/:id/workspace | Solo propietario; proyecto/salón activos, alumno aún matriculado |
| GET /progress | student: su propio historial |
| GET /students/:id/progress | admin: historial; teacher: solo curso/nivel de sus salones activos con matrícula |
| PUT /progress/:lessonId | student: lección publicada de curso/nivel con matrícula activa |

Recurso ajeno: 404; rol no permitido: 403; JWT ausente/inválido o cuenta suspendida: 401.
Conflictos de versión, username/FK o transacción concurrente: 409; fallo de BD: 503 genérico.
POST student/classroom/project/consent devuelve 201; PUT/PATCH/GET devuelve 200.
Los errores de driver no se imprimen ni se incluyen en la respuesta.

## Cuerpos de ejemplo (sin credenciales reales)

POST /students: username, display_name y password (12 caracteres, máximo 72 bytes UTF-8).
El alumno se crea pending. No hay alta pública ni rol/status elegidos por el cliente.
POST consent: guardian_name, consent_version y guardian_contact_email opcional. La fecha
la establece el servidor. El administrador debe tener evidencia válida antes de registrar
consentimiento real: este endpoint registra evidencia, no verifica identidad ni sustituye
el consentimiento informado. DELETE revoca todas las evidencias vigentes y suspende
atómicamente; reactivar exige nueva evidencia. La matrícula también exige consentimiento,
cuenta student activa y salón active. Las transacciones son serializables; un conflicto
requiere repetir la operación. No se borran alumnos ni historial.

POST /classrooms: name, level_id, course_id, academic_year (2000–2100), course_start_date
(YYYY-MM-DD válido), school_name opcional; teacher_id opcional para teacher y obligatorio
para admin. Catálogos publicados y docente activo se verifican. PATCH admite name,
school_name y status; no cambia docente, nivel ni curso.

POST /projects:

```json
{"title":"Mi clasificador","project_type":"blocks","classroom_id":"UUID_V4_DEL_SALON"}
```

classroom_id es opcional; los proyectos personales no exigen matrícula. Solo el propietario
edita su trabajo, incluso si un administrador/docente puede leerlo. Archivar conserva la
información y bloquea nuevos guardados del workspace. No hay borrado definitivo en estas APIs.

PUT /projects/:id/workspace:

```json
{
  "version": 0,
  "blocks": {
    "schemaVersion": 1,
    "nodes": [{"id":"entrada","type":"input","position":{"x":0,"y":0},"data":{"label":"Datos"}}],
    "edges": [],
    "viewport": {"x":0,"y":0,"zoom":1}
  }
}
```

version=0 crea versión 1. Para actualizar, enviar la versión recibida por GET/PUT: el
servidor la incrementa. Dos peticiones con la misma versión producen un éxito y un 409.
Workspace y snapshot de workspace_versions se escriben en la misma transacción. La respuesta
incluye blocks como objeto, sin blocks_json. Límite 64 KiB, 200 nodos, 500 aristas; IDs
únicos, posiciones finitas, referencias de aristas existentes y zoom positivo. No ejecuta
código, entrena modelos ni valida aún todas las reglas pedagógicas del editor (hito 8).

PUT /progress/:lessonId: {"completed_sections":2}. El servidor obtiene sections del contenido
publicado, valida el límite y calcula porcentaje/estado. El progreso no retrocede y repetir
una escritura es idempotente. completed_at aparece al completar. Es avance declarado por
el alumno, no una calificación ni evidencia de respuestas correctas a quizzes.

## Prueba completa en Windows

Primero detener la API y actualizar (después de integrar el PR):

```powershell
cd C:\Users\franc\Escritorio\ProyectoIntegrador2
git pull origin main
cd Backend
npm ci
npm test
npm run prisma:status
npm run start:dev
```

Mantener el .env funcional y el JWT_SECRET. No reimportar SQL ni repetir baseline: no hay
cambios de esquema. La API debe quedar iniciada en esa ventana. En otra PowerShell:

```powershell
cd C:\Users\franc\Escritorio\ProyectoIntegrador2\Backend
npm run test:apis:db
Invoke-RestMethod http://127.0.0.1:3000/health
```

El helper pide una vez la contraseña actual de las tres cuentas aiblocks_demo del hito 5;
no la guarda ni imprime. Para automatizar sin el helper, configurar DEMO_PASSWORD de forma
temporal y ejecutar node scripts/apis-smoke.cjs, restaurando la variable al terminar.
No hay contraseña fija en el repositorio. Se respeta la elección local del usuario.

Esta prueba **escribe datos sintéticos por HTTP**: crea un salón, un alumno pending, una
evidencia de tutor expresamente SINTÉTICA, matrícula, proyecto, versiones y progreso. Hace
lecturas independientes con Prisma para comprobar persistencia en MySQL, cambia la clave
aleatoria del alumno temporal, verifica invalidación del JWT y prueba guardados concurrentes.
No toca las contraseñas ni el estado de las tres cuentas demo originales. Al terminar archiva
el proyecto y salón creados y revoca/suspende el alumno temporal. Conserva los registros como
evidencia; repetir añade otra ejecución sintética. Si una fase falla, intenta archivar/suspender
solo los registros cuyos IDs creó y reporta si falla esa finalización. Solo se permite en
NODE_ENV=development y BD localhost/127.0.0.1/::1. Necesita el seed didáctico del hito 2.

No repetir muchos logins seguidos: el límite es 10/min por IP/ruta. Ante 429 esperar un minuto.
Compartir solo PASS/FAIL y health, sin .env, claves, hashes, tokens o contactos de tutores.

## Validación y alcance

36 pruebas automáticas pasan (19 anteriores y 17 del hito 6). Tests HTTP usan NestJS, JWT, DTO y Guards reales con repositorios sustituidos; tests de
adaptadores verifican filtros, proyecciones, transacción de snapshots, CAS y progreso
condicional. Se ejecuta además el script de integración completo contra HTTP con un doble de BD,
incluida la finalización que solo archiva/suspende los registros creados. Estas pruebas
no sustituyen la ejecución real de test:apis:db en el MySQL del usuario.
La prueba en ese PC y en MariaDB/Plesk sigue pendiente hasta recibir evidencia.
Frontend conectado (7), simulación/editor integrado (8), auditoría/seguridad general (9)
y despliegue (12) continúan pendientes. No se agregan dependencias ni se cambia Prisma.
