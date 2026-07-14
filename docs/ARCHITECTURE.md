# Arquitectura de PTR Radio Automation

## Principios

PTR Radio es la capa principal de operación. No lee, escribe ni modifica archivos internos de AzuraCast. Toda integración se concentra en `backend/src/services/azuracast.js` y utiliza endpoints de su API oficial.

## Componentes

- `frontend/`: SPA React con Vite y TailwindCSS.
- `backend/`: API REST modular sobre Express.
- `database/`: almacenamiento persistente SQLite (el archivo no se versiona).
- `docker/`: imagen de producción multi-stage.
- `assets/`: recursos de audio e imagen futuros.
- `scripts/`: utilidades operativas.
- `docs/`: decisiones y documentación técnica.

En producción, Express sirve tanto la API `/api` como el frontend compilado en el puerto 8091. En desarrollo, Vite utiliza el puerto 5173 y envía `/api` al 8091.

## Expansión prevista

Los módulos de biblioteca, programación, relojes y cartuchera deben crecer como dominios independientes con sus propias rutas, servicios y tablas. La autenticación visual de esta primera versión debe reemplazarse por sesiones seguras, usuarios persistentes y contraseñas con hash antes de exponer el sistema públicamente.
