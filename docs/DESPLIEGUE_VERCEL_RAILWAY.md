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

No uses rutas, barras finales, credenciales ni comodines. El backend también incorpora este dominio exacto aunque Railway no defina `NODE_ENV`. Si Vercel cambia el dominio de producción, actualiza el código y la variable, y redespliega Railway.

## Vercel

El archivo `Frontend/vercel.json` reescribe las rutas de la SPA hacia `index.html`.
Por ello, enlaces directos como `/proyectos`, `/inicio` o
`/entrenamiento?project=...` se resuelven en el navegador y no devuelven 404.
Un archivo `.htaccess` solo cumple esta función en Apache; Vercel no lo utiliza.

No es obligatorio definir una variable porque el frontend usa Railway como destino de producción. Si se desea dejar explícito, crea:

```text
VITE_API_URL=https://proyectointegrador2-production.up.railway.app
```

Después de cambiar una variable `VITE_*`, ejecuta un redeploy en Vercel: Vite la incorpora durante la compilación.
