# Hito 7 — Frontend conectado a la API

El frontend conserva la experiencia visual existente y ahora consume la API NestJS. El navegador solo conoce la URL pública de la API; nunca recibe credenciales SQL ni secretos JWT.

## Funcionalidad conectada

- Inicio de sesión, restauración de sesión y cierre de sesión.
- Protección de rutas, roles y obligación de cambiar contraseña.
- Consulta y creación de proyectos del usuario autenticado.
- Selección del proyecto para las pantallas de dataset, preparación y modelo. Estas tres pantallas continúan siendo ejemplos educativos: todavía no guardan sus cambios.
- Salones, creación por docente/admin, matrícula y retiro, lecciones y progreso de lectura.
- Alta de alumnos pendiente, consentimiento y activación por administrador.
- Mensajes seguros para errores HTTP, expiración de sesión y reintentos.

## Prueba local en Windows

Primero actualiza el repositorio y deja la API iniciada en una terminal distinta:

```powershell
cd C:\Users\franc\Escritorio\ProyectoIntegrador2
git pull origin main
cd Backend
npm ci
npm run start:dev
```

En otra terminal, prepara y levanta el frontend:

```powershell
cd C:\Users\franc\Escritorio\ProyectoIntegrador2\Frontend
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm test
npm run build
npm run dev
```

Abre `http://127.0.0.1:5173`. La plantilla `.env.example` apunta a la API local en el puerto 3000. Si se cambia el host o el puerto del backend, actualiza únicamente `VITE_API_URL` en `Frontend/.env` y reinicia Vite.

Inicia sesión con una de las cuentas demo locales que ya creaste durante el hito 5. No copies su contraseña a archivos ni a GitHub.

Comprueba al menos este recorrido:

1. Alumno: iniciar sesión, crear un proyecto, abrirlo y registrar la lectura de una lección matriculada.
2. Docente: crear un salón y matricular a un alumno activo usando el identificador que muestra la vista de administración.
3. Administrador: registrar un alumno, guardar el consentimiento y activarlo.
4. Cambiar la contraseña de una cuenta; la aplicación debe cerrar la sesión y pedir el nuevo inicio de sesión.

Las pruebas automáticas del frontend simulan HTTP para cubrir formularios, rutas protegidas, roles, expiración, errores, progreso y XSS. La demostración anterior es la evidencia de integración real con tu MySQL local.

## Variables públicas del frontend

```dotenv
VITE_API_URL=http://127.0.0.1:3000
```

Todo valor `VITE_*` se incluye en el bundle del navegador. Solo se permite aquí el origen de la API.
