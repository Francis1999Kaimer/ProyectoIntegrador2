# DER y diseño físico — AI Blocks Studio (APF2 / Hito 2)

Este documento describe el modelo físico implementado en [`database/schema.sql`](../database/schema.sql). **El script SQL es la fuente de verdad.** El diagrama y el diccionario se generaron a partir de sus definiciones de tablas, columnas, índices y relaciones.

**Motor objetivo:** MySQL 8.0.16+ local / MariaDB 10.6+ Plesk. Se debe verificar la versión exacta antes del despliegue.  
**BD local:** `aiblockstudio` (se selecciona en el cliente; el script no crea ni borra la BD).  
**Codificación:** InnoDB, `utf8mb4_unicode_ci`.  
**IDs:** UUID `CHAR(36)` con colación ASCII binaria, generados por el backend.  
**Fechas:** `DATETIME` con convención UTC en la API.  
**JSON de bloques:** `LONGTEXT` con `JSON_VALID()` y validación adicional de estructura en NestJS; evita la incompatibilidad de representación del tipo JSON nativo entre ambos motores.

## Resumen de entidades

| Tabla | Descripción | Columnas | PK | FKs | Índices definidos |
|---|---|---:|---|---:|---:|
| `levels` | Rutas de edad configurables. | 6 | `id` | 0 | 1 |
| `users` | Credenciales hash y rol; nunca contraseñas en texto plano. | 11 | `id` | 0 | 3 |
| `courses` | Cursos y número previsto de semanas. | 8 | `id` | 0 | 1 |
| `course_weeks` | Catálogo de las 24 semanas, objetivos y fase. | 7 | `id` | 1 | 2 |
| `lessons` | Variante de cada clase por semana y ruta. | 10 | `id` | 2 | 2 |
| `classrooms` | Salones administrados por un profesor. | 11 | `id` | 3 | 3 |
| `classroom_enrollments` | Matrícula alumnos-salones N:M. | 3 | `classroom_id`, `student_id` | 2 | 1 |
| `guardian_consents` | Consentimiento del apoderado para menores. | 8 | `id` | 1 | 1 |
| `projects` | Proyectos individuales opcionalmente asociados a salón. | 8 | `id` | 2 | 2 |
| `workspaces` | Versión actual del grafo React Flow, 1:1 por proyecto. | 6 | `id` | 1 | 1 |
| `workspace_versions` | Historial versionado del grafo del editor. | 5 | `id` | 1 | 1 |
| `simulation_runs` | Parámetros, métricas y semilla de la ejecución educativa. | 14 | `id` | 2 | 2 |
| `lesson_progress` | Progreso alumno-clase, sin duplicados. | 9 | `id` | 2 | 2 |
| `challenges` | Reto base de la semana y ruta. | 11 | `id` | 2 | 2 |
| `classroom_challenges` | Programación de retos con ventana por salón. | 6 | `id` | 2 | 3 |
| `challenge_attempts` | Intentos con expiración en servidor. | 10 | `id` | 2 | 2 |
| `audit_logs` | Trazabilidad de acciones sensibles. | 8 | `id` | 1 | 3 |

Total: **17 tablas** y **24 relaciones FK**. La matrícula escolar se modela con tabla puente; el workspace principal tiene unicidad por proyecto. El modelo permite avanzar desde datos mock hacia una primera versión real sin imponer aún las 72 clases completas del currículo.

## Diagrama entidad-relación (Mermaid)

```mermaid
erDiagram
  levels {
    SMALLINT id PK
    VARCHAR slug UK
    VARCHAR name
    TINYINT min_age
    TINYINT max_age
    DATETIME created_at
  }
  users {
    CHAR id PK
    VARCHAR username UK
    VARCHAR email UK
    VARCHAR password_hash
    VARCHAR role
    VARCHAR status
    VARCHAR display_name
    BOOLEAN must_change_password
    DATETIME last_login_at
    DATETIME created_at
    DATETIME updated_at
  }
  courses {
    CHAR id PK
    VARCHAR slug UK
    VARCHAR title
    TEXT description
    TINYINT total_weeks
    VARCHAR status
    DATETIME created_at
    DATETIME updated_at
  }
  course_weeks {
    CHAR id PK
    CHAR course_id FK
    TINYINT week_number
    TINYINT phase
    VARCHAR title
    VARCHAR objective
    DATETIME created_at
  }
  lessons {
    CHAR id PK
    CHAR course_week_id FK
    SMALLINT level_id FK
    VARCHAR title
    TEXT summary
    LONGTEXT content_json
    SMALLINT duration_minutes
    VARCHAR status
    DATETIME created_at
    DATETIME updated_at
  }
  classrooms {
    CHAR id PK
    CHAR teacher_id FK
    SMALLINT level_id FK
    CHAR course_id FK
    VARCHAR name
    VARCHAR school_name
    SMALLINT academic_year
    DATE course_start_date
    VARCHAR status
    DATETIME created_at
    DATETIME updated_at
  }
  classroom_enrollments {
    CHAR classroom_id PK,FK
    CHAR student_id PK,FK
    DATETIME enrolled_at
  }
  guardian_consents {
    CHAR id PK
    CHAR student_id FK
    VARCHAR guardian_name
    VARCHAR guardian_contact_email
    VARCHAR consent_version
    DATETIME consented_at
    DATETIME revoked_at
    DATETIME recorded_at
  }
  projects {
    CHAR id PK
    CHAR owner_id FK
    CHAR classroom_id FK
    VARCHAR title
    VARCHAR project_type
    VARCHAR status
    DATETIME created_at
    DATETIME updated_at
  }
  workspaces {
    CHAR id PK
    CHAR project_id UK FK
    INT version
    LONGTEXT blocks_json
    DATETIME created_at
    DATETIME updated_at
  }
  workspace_versions {
    CHAR id PK
    CHAR workspace_id FK
    INT version
    LONGTEXT blocks_json
    DATETIME created_at
  }
  simulation_runs {
    CHAR id PK
    CHAR workspace_id FK
    CHAR requested_by FK
    INT workspace_version
    VARCHAR provider
    VARCHAR status
    INT seed
    LONGTEXT parameters_json
    LONGTEXT metrics_json
    DECIMAL accuracy
    DECIMAL loss
    DATETIME started_at
    DATETIME finished_at
    DATETIME created_at
  }
  lesson_progress {
    CHAR id PK
    CHAR student_id FK
    CHAR lesson_id FK
    VARCHAR status
    TINYINT completed_sections
    TINYINT progress_percent
    DATETIME last_opened_at
    DATETIME completed_at
    DATETIME updated_at
  }
  challenges {
    CHAR id PK
    CHAR course_week_id FK
    SMALLINT level_id FK
    VARCHAR title
    VARCHAR challenge_type
    LONGTEXT config_json
    INT time_limit_seconds
    TINYINT max_attempts
    DECIMAL max_score
    VARCHAR status
    DATETIME created_at
  }
  classroom_challenges {
    CHAR id PK
    CHAR classroom_id FK
    CHAR challenge_id FK
    DATETIME open_at
    DATETIME close_at
    DATETIME created_at
  }
  challenge_attempts {
    CHAR id PK
    CHAR classroom_challenge_id FK
    CHAR student_id FK
    TINYINT attempt_no
    VARCHAR status
    DATETIME started_at
    DATETIME expires_at
    DATETIME submitted_at
    DECIMAL score
    LONGTEXT answer_json
  }
  audit_logs {
    CHAR id PK
    CHAR actor_id FK
    VARCHAR action
    VARCHAR entity_type
    CHAR entity_id
    VARCHAR ip_address
    LONGTEXT metadata_json
    DATETIME occurred_at
  }
  courses ||--o{ course_weeks : "course_id"
  course_weeks ||--o{ lessons : "course_week_id"
  levels ||--o{ lessons : "level_id"
  users ||--o{ classrooms : "teacher_id"
  levels ||--o{ classrooms : "level_id"
  courses ||--o{ classrooms : "course_id"
  classrooms ||--o{ classroom_enrollments : "classroom_id"
  users ||--o{ classroom_enrollments : "student_id"
  users ||--o{ guardian_consents : "student_id"
  users ||--o{ projects : "owner_id"
  classrooms ||--o{ projects : "classroom_id"
  projects ||--o| workspaces : "project_id"
  workspaces ||--o{ workspace_versions : "workspace_id"
  workspaces ||--o{ simulation_runs : "workspace_id"
  users ||--o{ simulation_runs : "requested_by"
  users ||--o{ lesson_progress : "student_id"
  lessons ||--o{ lesson_progress : "lesson_id"
  course_weeks ||--o{ challenges : "course_week_id"
  levels ||--o{ challenges : "level_id"
  classrooms ||--o{ classroom_challenges : "classroom_id"
  challenges ||--o{ classroom_challenges : "challenge_id"
  classroom_challenges ||--o{ challenge_attempts : "classroom_challenge_id"
  users ||--o{ challenge_attempts : "student_id"
  users ||--o{ audit_logs : "actor_id"
```

El símbolo de cardinalidad expresa la asociación estructural. La pertenencia a un salón, la identidad de profesor/alumno y las reglas de acceso de menores deben **validarse en NestJS**; las FK por sí solas no comprueban el valor de `users.role`. Los retos deben validarse contra `open_at`, `close_at`, `expires_at` y membresía **en el servidor**, no únicamente en la UI.

## Diccionario físico de datos

### levels

Rutas de edad configurables.

| Columna | Tipo SQL | Permite NULL | Clave |
|---|---|---|---|
| `id` | `SMALLINT` | NO | PK |
| `slug` | `VARCHAR(32)` | NO | UK |
| `name` | `VARCHAR(80)` | NO |  |
| `min_age` | `TINYINT` | NO |  |
| `max_age` | `TINYINT` | SÍ |  |
| `created_at` | `DATETIME` | NO |  |

**Índices UNIQUE y de consulta:** `uq_levels_slug(slug)`.  
**Claves foráneas:** Ninguna.

### users

Credenciales hash y rol; nunca contraseñas en texto plano.

| Columna | Tipo SQL | Permite NULL | Clave |
|---|---|---|---|
| `id` | `CHAR(36)` | NO | PK |
| `username` | `VARCHAR(64)` | NO | UK |
| `email` | `VARCHAR(191)` | SÍ | UK |
| `password_hash` | `VARCHAR(255)` | NO |  |
| `role` | `VARCHAR(16)` | NO |  |
| `status` | `VARCHAR(16)` | NO |  |
| `display_name` | `VARCHAR(120)` | NO |  |
| `must_change_password` | `BOOLEAN` | NO |  |
| `last_login_at` | `DATETIME` | SÍ |  |
| `created_at` | `DATETIME` | NO |  |
| `updated_at` | `DATETIME` | NO |  |

**Índices UNIQUE y de consulta:** `uq_users_username(username)`, `uq_users_email(email)`, `ix_users_role_status(role, status)`.  
**Claves foráneas:** Ninguna.

### courses

Cursos y número previsto de semanas.

| Columna | Tipo SQL | Permite NULL | Clave |
|---|---|---|---|
| `id` | `CHAR(36)` | NO | PK |
| `slug` | `VARCHAR(80)` | NO | UK |
| `title` | `VARCHAR(180)` | NO |  |
| `description` | `TEXT` | SÍ |  |
| `total_weeks` | `TINYINT` | NO |  |
| `status` | `VARCHAR(16)` | NO |  |
| `created_at` | `DATETIME` | NO |  |
| `updated_at` | `DATETIME` | NO |  |

**Índices UNIQUE y de consulta:** `uq_courses_slug(slug)`.  
**Claves foráneas:** Ninguna.

### course_weeks

Catálogo de las 24 semanas, objetivos y fase.

| Columna | Tipo SQL | Permite NULL | Clave |
|---|---|---|---|
| `id` | `CHAR(36)` | NO | PK |
| `course_id` | `CHAR(36)` | NO |  FK |
| `week_number` | `TINYINT` | NO |  |
| `phase` | `TINYINT` | NO |  |
| `title` | `VARCHAR(160)` | NO |  |
| `objective` | `VARCHAR(300)` | NO |  |
| `created_at` | `DATETIME` | NO |  |

**Índices UNIQUE y de consulta:** `uq_course_weeks_number(course_id, week_number)`, `ix_course_weeks_phase(course_id, phase)`.  
**Claves foráneas:** `course_id → courses(id)` (`ON DELETE CASCADE`).

### lessons

Variante de cada clase por semana y ruta.

| Columna | Tipo SQL | Permite NULL | Clave |
|---|---|---|---|
| `id` | `CHAR(36)` | NO | PK |
| `course_week_id` | `CHAR(36)` | NO |  FK |
| `level_id` | `SMALLINT` | NO |  FK |
| `title` | `VARCHAR(180)` | NO |  |
| `summary` | `TEXT` | NO |  |
| `content_json` | `LONGTEXT` | NO |  |
| `duration_minutes` | `SMALLINT` | NO |  |
| `status` | `VARCHAR(16)` | NO |  |
| `created_at` | `DATETIME` | NO |  |
| `updated_at` | `DATETIME` | NO |  |

**Índices UNIQUE y de consulta:** `uq_lessons_week_level(course_week_id, level_id)`, `ix_lessons_level_status(level_id, status)`.  
**Claves foráneas:** `course_week_id → course_weeks(id)` (`ON DELETE CASCADE`); `level_id → levels(id)` (`ON DELETE RESTRICT`).

### classrooms

Salones administrados por un profesor.

| Columna | Tipo SQL | Permite NULL | Clave |
|---|---|---|---|
| `id` | `CHAR(36)` | NO | PK |
| `teacher_id` | `CHAR(36)` | NO |  FK |
| `level_id` | `SMALLINT` | NO |  FK |
| `course_id` | `CHAR(36)` | NO |  FK |
| `name` | `VARCHAR(120)` | NO |  |
| `school_name` | `VARCHAR(180)` | SÍ |  |
| `academic_year` | `SMALLINT` | NO |  |
| `course_start_date` | `DATE` | NO |  |
| `status` | `VARCHAR(16)` | NO |  |
| `created_at` | `DATETIME` | NO |  |
| `updated_at` | `DATETIME` | NO |  |

**Índices UNIQUE y de consulta:** `ix_classrooms_teacher_status(teacher_id, status)`, `ix_classrooms_level(level_id)`, `ix_classrooms_course(course_id)`.  
**Claves foráneas:** `teacher_id → users(id)` (`ON DELETE RESTRICT`); `level_id → levels(id)` (`ON DELETE RESTRICT`); `course_id → courses(id)` (`ON DELETE RESTRICT`).

### classroom_enrollments

Matrícula alumnos-salones N:M.

| Columna | Tipo SQL | Permite NULL | Clave |
|---|---|---|---|
| `classroom_id` | `CHAR(36)` | NO | PK FK |
| `student_id` | `CHAR(36)` | NO | PK FK |
| `enrolled_at` | `DATETIME` | NO |  |

**Índices UNIQUE y de consulta:** `ix_classroom_enrollments_student(student_id)`.  
**Claves foráneas:** `classroom_id → classrooms(id)` (`ON DELETE CASCADE`); `student_id → users(id)` (`ON DELETE RESTRICT`).

### guardian_consents

Consentimiento del apoderado para menores.

| Columna | Tipo SQL | Permite NULL | Clave |
|---|---|---|---|
| `id` | `CHAR(36)` | NO | PK |
| `student_id` | `CHAR(36)` | NO |  FK |
| `guardian_name` | `VARCHAR(120)` | NO |  |
| `guardian_contact_email` | `VARCHAR(191)` | SÍ |  |
| `consent_version` | `VARCHAR(32)` | NO |  |
| `consented_at` | `DATETIME` | NO |  |
| `revoked_at` | `DATETIME` | SÍ |  |
| `recorded_at` | `DATETIME` | NO |  |

**Índices UNIQUE y de consulta:** `ix_guardian_consents_student_date(student_id, consented_at)`.  
**Claves foráneas:** `student_id → users(id)` (`ON DELETE RESTRICT`).

### projects

Proyectos individuales opcionalmente asociados a salón.

| Columna | Tipo SQL | Permite NULL | Clave |
|---|---|---|---|
| `id` | `CHAR(36)` | NO | PK |
| `owner_id` | `CHAR(36)` | NO |  FK |
| `classroom_id` | `CHAR(36)` | SÍ |  FK |
| `title` | `VARCHAR(180)` | NO |  |
| `project_type` | `VARCHAR(40)` | NO |  |
| `status` | `VARCHAR(16)` | NO |  |
| `created_at` | `DATETIME` | NO |  |
| `updated_at` | `DATETIME` | NO |  |

**Índices UNIQUE y de consulta:** `ix_projects_owner_updated(owner_id, updated_at)`, `ix_projects_classroom(classroom_id)`.  
**Claves foráneas:** `owner_id → users(id)` (`ON DELETE RESTRICT`); `classroom_id → classrooms(id)` (`ON DELETE SET NULL`).

### workspaces

Versión actual del grafo React Flow, 1:1 por proyecto.

| Columna | Tipo SQL | Permite NULL | Clave |
|---|---|---|---|
| `id` | `CHAR(36)` | NO | PK |
| `project_id` | `CHAR(36)` | NO | UK FK |
| `version` | `INT` | NO |  |
| `blocks_json` | `LONGTEXT` | NO |  |
| `created_at` | `DATETIME` | NO |  |
| `updated_at` | `DATETIME` | NO |  |

**Índices UNIQUE y de consulta:** `uq_workspaces_project(project_id)`.  
**Claves foráneas:** `project_id → projects(id)` (`ON DELETE CASCADE`).

### workspace_versions

Historial versionado del grafo del editor.

| Columna | Tipo SQL | Permite NULL | Clave |
|---|---|---|---|
| `id` | `CHAR(36)` | NO | PK |
| `workspace_id` | `CHAR(36)` | NO |  FK |
| `version` | `INT` | NO |  |
| `blocks_json` | `LONGTEXT` | NO |  |
| `created_at` | `DATETIME` | NO |  |

**Índices UNIQUE y de consulta:** `uq_workspace_versions_number(workspace_id, version)`.  
**Claves foráneas:** `workspace_id → workspaces(id)` (`ON DELETE CASCADE`).

### simulation_runs

Parámetros, métricas y semilla de la ejecución educativa.

| Columna | Tipo SQL | Permite NULL | Clave |
|---|---|---|---|
| `id` | `CHAR(36)` | NO | PK |
| `workspace_id` | `CHAR(36)` | NO |  FK |
| `requested_by` | `CHAR(36)` | NO |  FK |
| `workspace_version` | `INT` | NO |  |
| `provider` | `VARCHAR(24)` | NO |  |
| `status` | `VARCHAR(16)` | NO |  |
| `seed` | `INT` | NO |  |
| `parameters_json` | `LONGTEXT` | NO |  |
| `metrics_json` | `LONGTEXT` | SÍ |  |
| `accuracy` | `DECIMAL(5,4)` | SÍ |  |
| `loss` | `DECIMAL(10,6)` | SÍ |  |
| `started_at` | `DATETIME` | SÍ |  |
| `finished_at` | `DATETIME` | SÍ |  |
| `created_at` | `DATETIME` | NO |  |

**Índices UNIQUE y de consulta:** `ix_simulation_runs_workspace_created(workspace_id, created_at)`, `ix_simulation_runs_user_created(requested_by, created_at)`.  
**Claves foráneas:** `workspace_id → workspaces(id)` (`ON DELETE CASCADE`); `requested_by → users(id)` (`ON DELETE RESTRICT`).

### lesson_progress

Progreso alumno-clase, sin duplicados.

| Columna | Tipo SQL | Permite NULL | Clave |
|---|---|---|---|
| `id` | `CHAR(36)` | NO | PK |
| `student_id` | `CHAR(36)` | NO |  FK |
| `lesson_id` | `CHAR(36)` | NO |  FK |
| `status` | `VARCHAR(16)` | NO |  |
| `completed_sections` | `TINYINT` | NO |  |
| `progress_percent` | `TINYINT` | NO |  |
| `last_opened_at` | `DATETIME` | SÍ |  |
| `completed_at` | `DATETIME` | SÍ |  |
| `updated_at` | `DATETIME` | NO |  |

**Índices UNIQUE y de consulta:** `uq_lesson_progress_student_lesson(student_id, lesson_id)`, `ix_lesson_progress_lesson(lesson_id)`.  
**Claves foráneas:** `student_id → users(id)` (`ON DELETE RESTRICT`); `lesson_id → lessons(id)` (`ON DELETE CASCADE`).

### challenges

Reto base de la semana y ruta.

| Columna | Tipo SQL | Permite NULL | Clave |
|---|---|---|---|
| `id` | `CHAR(36)` | NO | PK |
| `course_week_id` | `CHAR(36)` | NO |  FK |
| `level_id` | `SMALLINT` | NO |  FK |
| `title` | `VARCHAR(180)` | NO |  |
| `challenge_type` | `VARCHAR(24)` | NO |  |
| `config_json` | `LONGTEXT` | NO |  |
| `time_limit_seconds` | `INT` | SÍ |  |
| `max_attempts` | `TINYINT` | NO |  |
| `max_score` | `DECIMAL(6,2)` | NO |  |
| `status` | `VARCHAR(16)` | NO |  |
| `created_at` | `DATETIME` | NO |  |

**Índices UNIQUE y de consulta:** `uq_challenges_week_level(course_week_id, level_id)`, `ix_challenges_level(level_id)`.  
**Claves foráneas:** `course_week_id → course_weeks(id)` (`ON DELETE CASCADE`); `level_id → levels(id)` (`ON DELETE RESTRICT`).

### classroom_challenges

Programación de retos con ventana por salón.

| Columna | Tipo SQL | Permite NULL | Clave |
|---|---|---|---|
| `id` | `CHAR(36)` | NO | PK |
| `classroom_id` | `CHAR(36)` | NO |  FK |
| `challenge_id` | `CHAR(36)` | NO |  FK |
| `open_at` | `DATETIME` | NO |  |
| `close_at` | `DATETIME` | NO |  |
| `created_at` | `DATETIME` | NO |  |

**Índices UNIQUE y de consulta:** `uq_classroom_challenges_pair(classroom_id, challenge_id)`, `ix_classroom_challenges_challenge(challenge_id)`, `ix_classroom_challenges_window(classroom_id, open_at, close_at)`.  
**Claves foráneas:** `classroom_id → classrooms(id)` (`ON DELETE CASCADE`); `challenge_id → challenges(id)` (`ON DELETE RESTRICT`).

### challenge_attempts

Intentos con expiración en servidor.

| Columna | Tipo SQL | Permite NULL | Clave |
|---|---|---|---|
| `id` | `CHAR(36)` | NO | PK |
| `classroom_challenge_id` | `CHAR(36)` | NO |  FK |
| `student_id` | `CHAR(36)` | NO |  FK |
| `attempt_no` | `TINYINT` | NO |  |
| `status` | `VARCHAR(16)` | NO |  |
| `started_at` | `DATETIME` | NO |  |
| `expires_at` | `DATETIME` | NO |  |
| `submitted_at` | `DATETIME` | SÍ |  |
| `score` | `DECIMAL(6,2)` | SÍ |  |
| `answer_json` | `LONGTEXT` | SÍ |  |

**Índices UNIQUE y de consulta:** `uq_challenge_attempts_number(classroom_challenge_id, student_id, attempt_no)`, `ix_challenge_attempts_student_status(student_id, status)`.  
**Claves foráneas:** `classroom_challenge_id → classroom_challenges(id)` (`ON DELETE CASCADE`); `student_id → users(id)` (`ON DELETE RESTRICT`).

### audit_logs

Trazabilidad de acciones sensibles.

| Columna | Tipo SQL | Permite NULL | Clave |
|---|---|---|---|
| `id` | `CHAR(36)` | NO | PK |
| `actor_id` | `CHAR(36)` | SÍ |  FK |
| `action` | `VARCHAR(80)` | NO |  |
| `entity_type` | `VARCHAR(64)` | NO |  |
| `entity_id` | `CHAR(36)` | SÍ |  |
| `ip_address` | `VARCHAR(45)` | SÍ |  |
| `metadata_json` | `LONGTEXT` | SÍ |  |
| `occurred_at` | `DATETIME` | NO |  |

**Índices UNIQUE y de consulta:** `ix_audit_logs_actor_date(actor_id, occurred_at)`, `ix_audit_logs_entity_date(entity_type, entity_id, occurred_at)`, `ix_audit_logs_occurred(occurred_at)`.  
**Claves foráneas:** `actor_id → users(id)` (`ON DELETE SET NULL`).


## Convenciones, integridad y seguridad

- Tablas en plural y columnas en `snake_case`; UUID de entidades operativas generados en el backend.
- Cada FK está explícita en el SQL, con `ON DELETE` documentado arriba. No se deshabilitan las FK durante la importación.
- Restricciones `CHECK` se usan para roles, estados, rangos, fechas y JSON. MySQL exige versión **8.0.16 o superior** para aplicarlas efectivamente.
- `UNIQUE` en emails, usuarios, (curso, semana), (semana, nivel), (alumno, clase), (proyecto, workspace), etc. `users.email` puede ser NULL para cuentas infantiles administradas por el profesor.
- Las claves administrativas de desarrollo no se incluyen en el seed. Sin consentimiento válido, una cuenta de menor no deberá activarse en la fase de backend.
- Para proteger datos personales: las API no deben devolver hashes, el acceso a filas debe filtrar por propietario/matrícula, y los eventos auditados no deben guardar contraseñas ni tokens.
- Hay controles de negocio que no pueden representarse únicamente mediante FK y `CHECK` (p. ej., profesor asignado, nivel del alumno, número de intentos, autorización y ventanas temporales): estarán en servicios y pruebas del backend.

## Datos iniciales y comprobación

`database/seed.sql` incluye **3 rutas**, **1 curso**, **24 semanas planificadas**, **3 clases piloto de la semana 1** y **3 retos piloto** (uno por ruta). Las semanas 2–24 **todavía no contienen tres variantes de clase**; se completarán en fases de contenido. No se insertan usuarios reales ni contraseñas predeterminadas.

Ver comandos de importación, consultas y pruebas en [`database/README.md`](../database/README.md). El script `database/verify.sql` comprueba los conteos esperados, y `database/check_model.py` coteja entidades/columnas/relaciones del Mermaid con el SQL.
