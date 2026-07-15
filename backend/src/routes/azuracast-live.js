import { Readable } from 'node:stream';
import { Router } from 'express';
import { AzuraCastError, azuraCastService } from '../services/AzuraCastService.js';

export const azuraCastLiveRouter = Router();

azuraCastLiveRouter.get('/live-stream', async (_req, res) => {
  try { res.json(await azuraCastService.getLiveStreamInfo()); }
  catch (error) { res.status(error instanceof AzuraCastError ? error.status : 500).json({ online: false, error: error.message || 'No se pudo consultar la señal.' }); }
});

azuraCastLiveRouter.get('/live-audio', async (req, res) => {
  const controller = new AbortController();
  req.once('aborted', () => controller.abort());
  res.once('close', () => controller.abort());
  try {
    const { response } = await azuraCastService.getLiveAudio(req.headers.range, controller.signal);
    res.status(response.status);
    for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control', 'icy-br', 'icy-name']) {
      const value = response.headers.get(name); if (value) res.setHeader(name, value);
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'no-store');
    Readable.fromWeb(response.body).on('error', () => res.destroy()).pipe(res);
  } catch (error) {
    if (error.name === 'AbortError' || res.headersSent) return;
    res.status(error instanceof AzuraCastError ? error.status : 502).json({ error: error.message || 'No se pudo transmitir la señal.' });
  }
});
