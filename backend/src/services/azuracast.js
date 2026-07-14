import { config } from '../config.js';

const fallback = { online: false, station: null, listeners: 0, nowPlaying: null, next: null };

export async function getAzuraCastStatus() {
  const { baseUrl, stationId, apiKey } = config.azuracast;
  if (!baseUrl || !stationId) return fallback;
  try {
    const response = await fetch(`${baseUrl}/api/nowplaying/${encodeURIComponent(stationId)}`, {
      headers: apiKey ? { 'X-API-Key': apiKey } : {}, signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error(`AzuraCast respondió ${response.status}`);
    const data = await response.json();
    return {
      online: Boolean(data.is_online), station: data.station?.name || null,
      listeners: data.listeners?.current || 0,
      nowPlaying: { title: data.now_playing?.song?.title || 'Sin título', artist: data.now_playing?.song?.artist || 'Desconocido', elapsed: data.now_playing?.elapsed || 0, duration: data.now_playing?.duration || 1 },
      next: { title: data.playing_next?.song?.title || 'Sin datos', artist: data.playing_next?.song?.artist || 'Desconocido' },
    };
  } catch (error) { return { ...fallback, error: error.message }; }
}
