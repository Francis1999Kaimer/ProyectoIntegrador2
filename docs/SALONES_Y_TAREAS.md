# Salones, cuentas y tareas

Este documento describe el MVP: el docente arma su salón con alumnos y tareas, el alumno entrega un proyecto entrenado y el docente lo califica. El curso de 24 semanas y sus lecciones ya no aparecen en la interfaz; sus tablas siguen en la base, sin uso.

## Relación entre las partes

```
DOCENTES ─N:M──► SALÓN ◄──N:M──► ALUMNO          (matrícula)
(responsable + adicionales)
                   │                 │
                   └──1:N── TAREA    └──1:N── PROYECTO
                             │                   ▲
                             └──1:N── ENTREGA ───┘   (una por alumno y tarea)
```

- **Salón:** tiene un docente responsable, docentes adicionales opcionales y un nivel. El curso es opcional.
- **Tarea:** pertenece a un salón. Tiene título, descripción, consigna, fecha de inicio, fecha de cierre y rango de notas.
- **Entrega:** pertenece a una tarea y a un alumno. El núcleo es un proyecto del alumno de ese salón, más una descripción opcional. Guarda el número de entrenamiento que tenía el proyecto al entregarse.

## Docentes del salón

- **Responsable:** cada salón tiene un docente responsable (`classrooms.teacher_id`), que es quien lo creó o quien asignó el administrador.
- **Docentes adicionales:** se registran en `classroom_teachers`. Todos los docentes del salón tienen los mismos permisos sobre alumnos (crear, matricular, retirar, restablecer contraseñas), tareas, entregas y notas, y ven los proyectos del salón en solo lectura.
- **Gestionar docentes:** el responsable y el administrador agregan o quitan docentes adicionales, y también editan, archivan o reabren el salón.
- **Salir del salón:** un docente adicional puede salir por su cuenta.
- **Responsable fijo:** el responsable no se puede quitar.
- **Salón archivado:** no se agregan docentes.

## Cuentas

| Acción | Alumno | Docente | Administrador |
|---|---|---|---|
| Crear alumnos | — | En sus salones (quedan matriculados) | En cualquier salón o sin salón |
| Restablecer contraseñas | — | De los alumnos de sus salones activos | De cualquier cuenta |
| Crear docentes | — | — | Sí |

- **Alta del alumno:** se hace en un paso y la cuenta queda **activa**. La casilla «Cuento con la autorización del padre, madre o tutor» es obligatoria y queda registrada en `guardian_consents` con la versión `casilla-alta-v1`. El nombre del tutor es opcional.
- **Revocar la autorización:** el administrador puede hacerlo; la cuenta queda suspendida y su sesión deja de funcionar.
- **Cambio de contraseña al ingresar:** es opcional. La casilla «Pedir que cambie la contraseña al ingresar» viene marcada por defecto, tanto al crear la cuenta como al restablecer la contraseña.
- **Sesiones abiertas:** al restablecer una contraseña se cierran las sesiones de esa cuenta.
- **Cuenta demo de alumno:** trae su autorización registrada una sola vez (versión `demo-local`), para poder matricularla.

## Tareas

**Estados:**
- **Próxima:** antes del inicio. El alumno ve solo el título y las fechas.
- **Abierta:** entre el inicio y el cierre.
- **Cerrada:** después del cierre.

**Reglas:**
- **Fechas:** la fecha de cierre debe ser posterior a la de inicio.
- **Notas:** la nota máxima debe ser mayor que la mínima; las notas tienen un decimal como máximo y el formulario sugiere de 0 a 20. El rango solo se puede cambiar mientras no haya entregas calificadas.
- **Entrega:** el alumno puede entregar solo con la tarea abierta. Debe elegir un proyecto propio de ese salón que no esté archivado. Puede reemplazar la entrega hasta el cierre, mientras no tenga nota.
- **Calificación:** el docente puede calificar en cualquier momento después de la entrega, también después del cierre.
- **Eliminar:** una tarea se puede eliminar solo si no tiene entregas.
- **Salón archivado:** todo queda en solo lectura (tareas, entregas, notas y entrenamiento de sus proyectos).
- **Alumno retirado del salón:** si había entregado, sigue apareciendo en la tarea con su entrega.
- **Atajo «Crear proyecto para esta tarea»:** abre el paso 0 en `/crear?salon=<id>` con el salón ya elegido.
- **Inicio:** el alumno ve «Tareas pendientes» (abiertas y sin entregar). El docente y el administrador ven «Entregas por calificar».

## API

| Método y ruta | Rol | Uso |
|---|---|---|
| `POST /students` | docente, administrador | Alta en un paso: `guardian_authorized: true`, `guardian_name?`, `classroom_id?` (obligatorio para el docente) y `require_password_change?`. |
| `POST /users/:id/password` | docente, administrador | Restablecer contraseña: `password` y `require_password_change?`. |
| `GET /classrooms/:id/teachers` | todos con acceso al salón | Docentes del salón, con `responsible`. |
| `GET /classrooms/:id/eligible-teachers` | responsable, administrador | Docentes activos que se pueden agregar. |
| `POST /classrooms/:id/teachers` · `DELETE /classrooms/:id/teachers/:teacherId` | responsable, administrador (un adicional puede quitarse a sí mismo) | Agregar o quitar un docente adicional: `teacher_id`. |
| `GET /classrooms/:id/assignments` | todos con acceso al salón | Tareas. El docente recibe conteos; el alumno, su entrega. |
| `POST /classrooms/:id/assignments` | docente del salón, administrador | Crear una tarea. |
| `GET /assignments/:id` | todos con acceso | Detalle. El docente recibe las entregas; el alumno, su entrega y sus proyectos del salón. |
| `PATCH /assignments/:id` · `DELETE /assignments/:id` | docente del salón, administrador | Editar o eliminar la tarea. |
| `PUT /assignments/:id/submission` | alumno matriculado | Entregar o reemplazar: `project_id` y `comment?`. |
| `PUT /assignments/:id/submissions/:studentId/grade` | docente del salón, administrador | Calificar: `grade` y `feedback?`. |
| `GET /assignments/pending` | todos | Pendientes para Inicio. |

## Base de datos

La migración `20261106120000_classroom_teachers` crea la tabla `classroom_teachers` (docentes adicionales).

La migración `20261106100000_classroom_assignments` solo agrega cosas:
- `classrooms.course_id` pasa a aceptar `NULL`.
- Se crea `assignments`, con chequeos de fechas y de rango de notas.
- Se crea `assignment_submissions`, con una entrega única por alumno y tarea.

No elimina datos.
