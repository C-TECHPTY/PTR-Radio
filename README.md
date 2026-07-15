# PTR Radio Automation

Sistema web profesional e independiente para operación y automatización radial. AzuraCast se utiliza únicamente como servidor de streaming y AutoDJ, siempre mediante su API oficial.

## Características de esta versión

- Login local de demostración (`admin` / `ptrradio`).
- Dashboard oscuro responsive con estado, oyentes, canción actual y próxima pista.
- Modos AutoDJ y Manual.
- Cartuchera inferior con 20 botones configurables.
- Módulos base: Biblioteca, Programación, Relojes Musicales, Cartuchera, AzuraCast y Configuración.
- API REST Express y persistencia SQLite.
- Motor On Air v1 protegido, con adaptador FFmpeg desacoplado y salida local de prueba.
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
- `GET /api/azuracast/now-playing` → canción actual y próxima canción.
- `GET /api/azuracast/station` → información segura de la estación.
- `GET /api/azuracast/history` → historial reciente.
- `GET /api/azuracast/listeners` → estadísticas de oyentes.

## Conexión con AzuraCast

Configure exclusivamente variables de entorno; no coloque credenciales en el código:

```env
AZURACAST_URL=https://radio.example.com
AZURACAST_API_KEY=your_api_key_here
AZURACAST_STATION_ID=1
AZURACAST_STATION_SHORT_NAME=ptr-radio
```

El backend añade `X-API-Key` únicamente en solicitudes salientes hacia AzuraCast. La clave nunca forma parte de las respuestas REST. El dashboard consulta el backend cada 15 segundos y mantiene una vista segura si el servidor remoto no responde.

Consulte [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para detalles técnicos.

La instalación y prueba segura de On Air Engine se documenta en [docs/ON_AIR_ENGINE.md](docs/ON_AIR_ENGINE.md). Ninguna salida de esta versión se conecta a Panda Radio principal.
