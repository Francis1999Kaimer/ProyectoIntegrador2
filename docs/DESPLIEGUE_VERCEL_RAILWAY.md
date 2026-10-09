# Despliegue: Vercel + Railway

El frontend detecta el entorno automáticamente:

- En `localhost` o `127.0.0.1` usa `http://127.0.0.1:3000`.
- En un dominio desplegado usa `https://proyectointegrador2-production.up.railway.app`.
- `VITE_API_URL` permite sobrescribir ambos valores durante una compilación.

## Railway

Configura la variable `CORS_ORIGINS` con los orígenes completos separados por comas. Debe incluir el dominio definitivo de Vercel, por ejemplo:

```text
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://proyecto-integrador2-two.vercel.app
```

No uses rutas, barras finales, credenciales ni comodines. El backend también incorpora este dominio exacto cuando corre en producción. Si Vercel cambia el dominio de producción, actualiza el código y la variable, y redespliega Railway.

## Vercel

No es obligatorio definir una variable porque el frontend usa Railway como destino de producción. Si se desea dejar explícito, crea:

```text
VITE_API_URL=https://proyectointegrador2-production.up.railway.app
```

Después de cambiar una variable `VITE_*`, ejecuta un redeploy en Vercel: Vite la incorpora durante la compilación.
