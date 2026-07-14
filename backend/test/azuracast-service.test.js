import assert from 'node:assert/strict';
import test from 'node:test';
import { AzuraCastError, AzuraCastService } from '../src/services/AzuraCastService.js';

test('normaliza now playing y envía la API key solo a AzuraCast', async (t) => {
  const originalFetch = global.fetch; let request;
  global.fetch = async (url, options) => { request = { url, options }; return { ok: true, json: async () => ({ is_online: true, station: { name: 'PTR' }, listeners: { current: 12 }, live: { is_live: false }, now_playing: { elapsed: 20, duration: 180, song: { title: 'Track', artist: 'Artist', album: 'Album', art: 'https://example.test/art.jpg' } }, playing_next: { song: { title: 'Next', artist: 'Other' } } }) }; };
  t.after(() => { global.fetch = originalFetch; });
  const service = new AzuraCastService({ url: 'https://radio.example', stationId: '1', stationShortName: 'ptr', apiKey: 'secret', timeoutMs: 100 });
  const result = await service.getDashboard();
  assert.equal(request.url, 'https://radio.example/api/nowplaying/1');
  assert.equal(request.options.headers['X-API-Key'], 'secret');
  assert.equal(result.nowPlaying.album, 'Album'); assert.equal(result.listeners, 12); assert.equal(result.azuracast.autoDj, true);
  assert.equal(JSON.stringify(result).includes('secret'), false);
});

test('carga y normaliza la biblioteca musical sin exponer credenciales', async (t) => {
  const originalFetch = global.fetch; let request;
  global.fetch = async (url, options) => { request = { url, options }; return { ok: true, json: async () => ([{ id: 7, unique_id: 'media-7', path: 'Salsa/tema.mp3', length: 245, size: 12345, song: { title: 'Tema', artist: 'Artista', album: 'Álbum', genre: 'Salsa', art: 'https://example.test/media.jpg' }, playlists: [{ id: 2, name: 'Rotación Salsa' }] }]) }; };
  t.after(() => { global.fetch = originalFetch; });
  const service = new AzuraCastService({ url: 'https://radio.example', stationId: '2', apiKey: 'secret', timeoutMs: 100 });
  const result = await service.getMediaLibrary();
  assert.equal(request.url, 'https://radio.example/api/station/2/files');
  assert.equal(request.options.headers['X-API-Key'], 'secret');
  assert.deepEqual(result[0], { id: 7, uniqueId: 'media-7', path: 'Salsa/tema.mp3', title: 'Tema', artist: 'Artista', album: 'Álbum', genre: 'Salsa', lyrics: '', artwork: 'https://example.test/media.jpg', duration: 245, size: 12345, mtime: null, playlists: [{ id: 2, name: 'Rotación Salsa' }] });
  assert.equal(JSON.stringify(result).includes('secret'), false);
});

test('rechaza una configuración incompleta sin revelar credenciales', async () => {
  const service = new AzuraCastService({ url: '', stationId: '', apiKey: 'secret' });
  await assert.rejects(service.getStatus(), (error) => error instanceof AzuraCastError && error.status === 503 && !error.message.includes('secret'));
});

test('rechaza respuestas JSON inválidas', async (t) => {
  const originalFetch = global.fetch; global.fetch = async () => ({ ok: true, json: async () => 'invalid' });
  t.after(() => { global.fetch = originalFetch; });
  const service = new AzuraCastService({ url: 'https://radio.example', stationId: '1', apiKey: 'secret' });
  await assert.rejects(service.getListeners(), /respuesta inválida/);
});