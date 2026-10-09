# Frontend — AI Blocks Studio

Frontend React 19 + TypeScript + Vite de AI Blocks Studio. Mantiene la interfaz educativa existente y, desde el hito 7, se conecta a la API NestJS para autenticación, proyectos, salones, alumnos, lecciones y progreso.

## Requisitos

- Node.js 22.22 o superior.
- Backend de este repositorio iniciado en `http://127.0.0.1:3000`.

## Ejecutar localmente

```powershell
cd C:\Users\franc\Escritorio\ProyectoIntegrador2
git pull origin main
cd Frontend
npm ci
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm test
npm run build
npm run dev
```

Abre `http://127.0.0.1:5173`. Consulta el procedimiento completo en [docs/FRONTEND_HITO7.md](../docs/FRONTEND_HITO7.md).

## Configuración

`.env` solo puede contener el origen público de la API:

```dotenv
VITE_API_URL=http://127.0.0.1:3000
```

No agregues `DATABASE_URL`, contraseñas, tokens o `JWT_SECRET`: cualquier variable `VITE_*` queda expuesta en el navegador.

## Estado de las pantallas

- Login, sesión, roles y cambio de clave: conectados.
- Proyectos: consulta y creación conectadas.
- Salones, matrícula, lecciones y progreso: conectados.
- Administración de alumnos, consentimiento y activación: conectados.
- Dataset, preparación, modelo, editor, entrenamiento, evaluación y predicción: conservan parte de la experiencia educativa original. La persistencia del editor y los resultados de entrenamiento se incorporan en el hito 8.

## Pruebas

`npm test` verifica el cliente HTTP y los flujos React con una API simulada: login, permisos, formularios, rutas protegidas, manejo de 401, progreso y escape del contenido de lecciones. `npm run build` comprueba tipos y genera el bundle de producción.
