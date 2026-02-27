# Ejecutar sin Docker Desktop

Objetivo: ejecutar el proyecto usando un Docker Engine alternativo en macOS (sin Docker Desktop). Recomendamos usar `colima` (ligero, compatible con Docker CLI) o `podman`.

Opciones recomendadas (elige UNA):

1) Colima + Docker CLI (recomendado en macOS)

- Instalar Homebrew (si no está instalado):

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

- Instalar `colima` y `docker` CLI:

```bash
brew install colima docker
```

- Iniciar Colima con espacio suficiente y soporte de CPU/RAM según necesites:

```bash
colima start --cpu 2 --memory 4 --disk 60
```

- Construir y levantar servicios (usa el `docker-compose.yml` del repo):

```bash
docker compose up --build
```

- Parar y remover:

```bash
docker compose down
colima stop
```

2) Podman + podman-compose (alternativa sin Docker Engine)

- Instalar Podman:

```bash
brew install podman podman-compose
```

- Iniciar el servicio de Podman (macOS):

```bash
podman system service -t 0 &
```

- Arrancar con `podman-compose` (compatibilidad variable, preferir Colima si hay problemas):

```bash
podman-compose up --build
```

Notas importantes
- El `docker-compose.yml` del repo fue adaptado para no usar opciones específicas de Docker Desktop (por ejemplo `:cached`).
- Se usa un volumen nombrado `node_modules` para evitar problemas de permisos entre host y contenedor.
- La base de datos Postgres expone el puerto `5432` para facilitar la conexión desde herramientas externas; en entornos productivos no se expone públicamente.
- La aplicación requiere la tabla `tickets` en la base de datos. Debes provisionar el esquema (migrations) o crear la tabla manualmente antes de ejecutar consultas reales.

¿Quieres que añada un script SQL de ejemplo para crear la tabla `tickets` y/o un servicio `adminer` en `docker-compose.yml` para administración rápida de la DB?