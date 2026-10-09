# Infrastructure — entornos APF2

## Desarrollo

- **MySQL** instalado en el equipo: `127.0.0.1:3306`, base `aiblockstudio`. Crear usuario específico para la aplicación cuando se implemente la BD (hito 2); la cuenta administrativa `root` no es una cuenta de aplicación recomendada.
- **Docker Compose** no es obligatorio. El servicio opcional `mariadb` usa perfil `db-container` y puerto de host 3307 para no colisionar con MySQL.
- **Redis/MinIO**: perfiles `extras`, fuera del alcance mínimo de APF2.

## Prueba alternativa con MariaDB en contenedor

1. Crear un archivo raíz `.env` a partir de `.env.example`, estableciendo secretos fuertes y privados para `MARIADB_ROOT_PASSWORD` y `MARIADB_APP_PASSWORD`.
2. Ejecutar `docker compose --profile db-container up -d mariadb`.
3. Apuntar `DATABASE_URL` al puerto `3307`, con el usuario y la contraseña del contenedor.
4. Nunca conectar ambos motores a la vez como si fueran una misma BD; son dos entornos separados.

No es necesario arrancar Docker para el frontend mock actual.

## Producción en Plesk (pendiente hito 12)

- Frontend Vite compilado a archivos estáticos.
- Backend NestJS ejecutado como aplicación Node.js, condicionado a que el hosting habilite Node.js y su versión requerida.
- BD MariaDB en Plesk.
- Configuración de HTTPS, secretos del servidor, respaldos, acceso mínimo y monitoreo.

El informe de replicación será una propuesta técnica basada en capacidades comprobadas del hosting; no declarar una réplica activa ni backups verificados sin evidencia.
