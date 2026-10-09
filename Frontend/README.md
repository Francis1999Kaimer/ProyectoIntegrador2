# Frontend — AI Blocks Studio

Prototipo UX/UI existente del entorno educativo visual por bloques. **Se conserva durante APF2** y se integrará progresivamente con el backend, sin reescribirlo.

## Stack existente

- React 19 + TypeScript + Vite.
- React Router, React Flow (`@xyflow/react`), Zustand y Lucide React.
- Capa de estilo inspirada en IBM Carbon y ajustes responsive.

## Ejecutar localmente

Requiere Node.js 22.22 o superior.

```powershell
cd C:\Users\franc\Escritorio\ProyectoIntegrador2\Frontend
npm install
npm run dev
```

Abrir `http://localhost:5173`.

## Estado real

El frontend continúa usando datos mock. Las pantallas existentes incluyen Inicio, Mis proyectos, Crear proyecto, Dataset, Preparación, Modelo, Editor, Entrenamiento, Evaluación y Predicción.

**Todavía no hay API ejecutable, autenticación real ni persistencia en MySQL**. Esto llegará con los hitos APF2 3 al 8.

## Integración prevista

```text
React/Vite → NestJS REST API → Service → Repository/Prisma → MySQL local o MariaDB/Plesk
```

Se incorporará `VITE_API_URL` en `Frontend/.env` privado y un cliente API tipado; no se usarán credenciales SQL ni secretos JWT en el navegador.

Ver `docs/architecture.md` y `docs/APF2_HITOS.md`.
