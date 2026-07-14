# PTR Radio Automation

Sistema web profesional e independiente para operación y automatización radial. AzuraCast se utiliza únicamente como servidor de streaming y AutoDJ, siempre mediante su API oficial.

## Características de esta versión

- Login local de demostración (`admin` / `ptrradio`).
- Dashboard oscuro responsive con estado, oyentes, canción actual y próxima pista.
- Modos AutoDJ y Manual.
- Cartuchera inferior con 20 botones configurables.
- Módulos base: Biblioteca, Programación, Relojes Musicales, Cartuchera, AzuraCast y Configuración.
- API REST Express y persistencia SQLite.
- Contenedores Docker con un único acceso público en `http://localhost:8091`.

## Desarrollo local

Requiere Node.js 20 o superior.

```bash
cp .env.example .env
npm install
npm run dev
```

Frontend: `http://localhost:5173` (redirige `/api` al backend). Backend: `http://localhost:8091`.

## Producción con Docker

```bash
docker compose up --build
```

Abra `http://localhost:8091`. La base de datos se conserva en el volumen `ptr-radio-data`.

## API inicial

- `GET /api/health` → `{ "status": "online" }`
- `GET /api/dashboard` → estado operativo agregado.
- `GET /api/cartwall` → botones de cartuchera.
- `PUT /api/cartwall/:id` → actualiza un botón.
- `GET /api/azuracast/status` → estado público de la estación configurada.

Consulte [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para detalles técnicos.
