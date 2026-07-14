import { config } from '../config.js';

export class AzuraCastError extends Error {
  constructor(message, status = 502) { super(message); this.name = 'AzuraCastError'; this.status = status; }
}

export class AzuraCastService {
  constructor(options = config.azuracast) {
    this.url = options.url; this.stationId = options.stationId;
    this.stationShortName = options.stationShortName; this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs || 7000;
  }
  isConfigured() { return Boolean(this.url && this.stationId && this.apiKey); }
  async request(path, timeoutMs = this.timeoutMs) {
    if (!this.isConfigured()) throw new AzuraCastError('AzuraCast no está configurado.', 503);
    let response;
    try {
      response = await fetch(`${this.url}${path}`, { headers: { Accept: 'application/json', 'X-API-Key': this.apiKey }, signal: AbortSignal.timeout(timeoutMs) });
    } catch (error) {
      const timedOut = error.name === 'TimeoutError' || error.name === 'AbortError';
      throw new AzuraCastError(timedOut ? 'AzuraCast excedió el tiempo de espera.' : 'No fue posible conectar con AzuraCast.', 503);
    }
    if (!response.ok) throw new AzuraCastError(`AzuraCast respondió con estado ${response.status}.`, response.status === 401 || response.status === 403 ? 502 : 503);
    try {
      const data = await response.json();
      if (data === null || typeof data !== 'object') throw new Error('Invalid payload');
      return data;
    } catch { throw new AzuraCastError('AzuraCast devolvió una respuesta inválida.', 502); }
  }
  getNowPlayingRaw() { return this.request(`/api/nowplaying/${encodeURIComponent(this.stationId)}`); }
  normalizeSong(entry) {
    if (!entry) return null;
    const song = entry.song || entry; const duration = Number(entry.duration || song.duration || 0); const elapsed = Number(entry.elapsed || 0);
    return { title: song.title || song.text || 'Sin título', artist: song.artist || 'Artista desconocido', album: song.album || '', artwork: song.art || song.artwork || null, duration, elapsed, remaining: Number(entry.remaining ?? Math.max(0, duration - elapsed)) };
  }
  normalizeMedia(entry) {
    const song = entry?.song || {};
    const playlists = Array.isArray(entry?.playlists) ? entry.playlists : [];
    return {
      id: entry?.id ?? null,
      uniqueId: entry?.unique_id || entry?.uniqueId || null,
      path: entry?.path || '',
      title: song.title || entry?.title || entry?.basename || 'Sin título',
      artist: song.artist || entry?.artist || 'Artista desconocido',
      album: song.album || entry?.album || '',
      genre: song.genre || entry?.genre || '',
      lyrics: song.lyrics || entry?.lyrics || '',
      artwork: song.art || entry?.art || entry?.artwork || null,
      duration: Number(entry?.length || entry?.duration || song.duration || 0),
      size: Number(entry?.size || 0),
      mtime: entry?.mtime || null,
      playlists: playlists.map((playlist) => typeof playlist === 'string'
        ? { id: null, name: playlist }
        : { id: playlist.id ?? null, name: playlist.name || playlist.short_name || '' }
      ).filter((playlist) => playlist.name),
    };
  }
  async getNowPlaying() { const data = await this.getNowPlayingRaw(); return { current: this.normalizeSong(data.now_playing), next: this.normalizeSong(data.playing_next), live: Boolean(data.live?.is_live), streamerName: data.live?.streamer_name || null }; }
  async getStatus() { const data = await this.getNowPlayingRaw(); return { connected: true, online: Boolean(data.is_online), station: data.station?.name || this.stationShortName || null, stationShortName: data.station?.shortcode || this.stationShortName || null, autoDj: !data.live?.is_live }; }
  async getListeners() { const data = await this.getNowPlayingRaw(); return { current: Number(data.listeners?.current || 0), unique: Number(data.listeners?.unique || 0), total: Number(data.listeners?.total || 0) }; }
  async getHistory() {
    const data = await this.request(`/api/station/${encodeURIComponent(this.stationId)}/history`);
    if (!Array.isArray(data)) throw new AzuraCastError('AzuraCast devolvió un historial inválido.', 502);
    return data.map((entry) => ({ playedAt: entry.played_at || null, ...this.normalizeSong(entry) }));
  }
  async getStation() {
    const data = await this.request(`/api/admin/stations/${encodeURIComponent(this.stationId)}`);
    return { id: data.id ?? this.stationId, name: data.name || null, shortName: data.short_name || data.shortcode || this.stationShortName || null, enabled: data.is_enabled !== false, frontendType: data.frontend_type || null, backendType: data.backend_type || null, autoDjEnabled: Boolean(data.backend_type && data.backend_type !== 'none'), publicPlayerUrl: data.public_player_url || null };
  }
  async getMediaLibrary() {
    const stationId = encodeURIComponent(this.stationId);
    const pageSize = 500;
    const maxPages = 1000;
    const media = [];

    let data = await this.request(`/api/station/${stationId}/files`, 60000);
    if (Array.isArray(data)) return data.map((entry) => this.normalizeMedia(entry));

    // Compatibility with releases/proxies that wrap this resource in pages.
    for (let page = 1; page <= maxPages; page += 1) {
      const rows = [data.rows, data.data, data.items].find(Array.isArray);
      if (!rows) throw new AzuraCastError('AzuraCast devolvió una biblioteca musical inválida.', 502);
      media.push(...rows);

      const total = Number(data.total ?? data.totalCount ?? data.recordsTotal ?? 0);
      const hasNext = data.hasMore === true
        || data.has_more === true
        || Boolean(data.links?.next)
        || (total > 0 && media.length < total)
        || (total === 0 && rows.length === pageSize);
      if (!hasNext || rows.length === 0) break;
      data = await this.request(`/api/station/${stationId}/files?current=${page + 1}&rowCount=${pageSize}`, 60000);
    }

    return media.map((entry) => this.normalizeMedia(entry));
  }
  async getDashboard() {
    const data = await this.getNowPlayingRaw();
    return { azuracast: { connected: true, online: Boolean(data.is_online), station: data.station?.name || this.stationShortName || null, stationShortName: data.station?.shortcode || this.stationShortName || null, autoDj: !data.live?.is_live }, listeners: Number(data.listeners?.current || 0), nowPlaying: this.normalizeSong(data.now_playing), next: this.normalizeSong(data.playing_next) };
  }
}

export const azuraCastService = new AzuraCastService();
