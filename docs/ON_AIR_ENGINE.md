# On Air Engine v1

On Air Engine genera audio real únicamente hacia una salida de prueba. El modo live, el mount principal, la entrada DJ principal y cualquier control de AutoDJ permanecen bloqueados.

## Arquitectura

`SQLite → ServerAudioEngineService → OnAirEngineService → AudioAdapter → salida test_only`

- `FfmpegAudioAdapter`: descarga temporalmente audio mediante el backend autenticado, genera la mezcla y elimina los temporales.
- `SilentDiagnosticAdapter`: fallback cuando FFmpeg no está disponible.
- Las contraseñas no se guardan en SQLite; una salida solo puede referenciar el nombre de una variable de entorno.

## Dependencia

Se requiere FFmpeg y FFprobe en `PATH`, o indicar sus rutas con `FFMPEG_PATH` y `FFPROBE_PATH`. En Debian/Ubuntu: `apt-get install ffmpeg`. La versión exacta depende del repositorio base. El paquete suele añadir aproximadamente 80–120 MB a una imagen slim.

Para desarrollo local se incluye `docker/Dockerfile.on-air-dev`. No se modificó el Dockerfile ni el Compose de producción.

## Prueba a archivo

1. Añada al menos tres pistas a Live Assist.
2. Abra **On Air Engine**.
3. Habilite **Archivo local de prueba**.
4. Marque ambas confirmaciones.
5. Pulse **Iniciar prueba a archivo**.

La salida predeterminada es `ptr-on-air-test.mp3` dentro del directorio temporal del sistema. Puede definir una ruta explícita con `ON_AIR_TEST_FILE`. La respuesta y los eventos muestran codec, duración y tamaño verificados con FFprobe.

Los medios se transfieren progresivamente a una caché temporal. El timeout de conexión y el de inactividad son independientes; `ON_AIR_MEDIA_MAX_DOWNLOAD_MS=0` desactiva el límite total mientras continúen llegando datos. Las descargas simultáneas del mismo `media_id` se deduplican y la caché se limpia por tamaño y antigüedad.

## Stream continuo local

Después de generar el archivo de prueba, inicie **Salida local de prueba** con ambas confirmaciones. La señal queda enlazada exclusivamente a:

`http://127.0.0.1:8092/stream.mp3`

Puede escucharla con `vlc http://127.0.0.1:8092/stream.mp3`. No se publica mediante Nginx, Docker ni AzuraCast.

## Seguridad

- Solo se aceptan salidas `test_only`.
- La prueba a archivo necesita doble confirmación.
- Stream e Icecast están bloqueados hasta configurar una salida separada.
- Stop y Stop de emergencia terminan FFmpeg y limpian temporales.
- No se envían API keys al navegador ni a la línea de comandos de FFmpeg.
- Panda Radio principal continúa operada por AutoDJ.
