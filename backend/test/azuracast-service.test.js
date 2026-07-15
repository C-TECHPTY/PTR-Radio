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
  assert.deepEqual(result[0], { id: 7, uniqueId: 'media-7', path: 'Salsa/tema.mp3', title: 'Tema', artist: 'Artista', album: 'Álbum', genre: 'Salsa', lyrics: '', artwork: 'https://example.test/media.jpg', audioUrl: null, duration: 245, size: 12345, mtime: null, playlists: [{ id: 2, name: 'Rotación Salsa' }] });
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

test('reúne todas las páginas de la biblioteca musical', async (t) => {
  const originalFetch = global.fetch; const requests = [];
  global.fetch = async (url) => {
    requests.push(url);
    const page = requests.length;
    return { ok: true, json: async () => ({ current: page, total: 3, rows: page === 1
      ? [{ id: 1, song: { title: 'Uno' } }, { id: 2, song: { title: 'Dos' } }]
      : [{ id: 3, song: { title: 'Tres' } }]
    }) };
  };
  t.after(() => { global.fetch = originalFetch; });
  const service = new AzuraCastService({ url: 'https://radio.example', stationId: 'station-shortcode', apiKey: 'secret' });
  const result = await service.getMediaLibrary();
  assert.equal(result.length, 3);
  assert.equal(requests.length, 2);
  assert.match(requests[1], /current=2/);
  assert.match(requests[0], /station\/station-shortcode\/files/);
});

test('acepta playlists como nombres o como objetos', () => {
  const service = new AzuraCastService({});
  const result = service.normalizeMedia({ playlists: ['General', { id: 2, short_name: 'rotacion' }] });
  assert.deepEqual(result.playlists, [{ id: null, name: 'General' }, { id: 2, name: 'rotacion' }]);
});
