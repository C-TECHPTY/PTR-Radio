import { Router } from 'express';
import { all, run } from '../database.js';
import { AzuraCastError, azuraCastService } from '../services/AzuraCastService.js';

export const api = Router();
const azuraRoute = (method) => async (_req, res) => {
  try { res.json(await azuraCastService[method]()); }
  catch (error) { res.status(error instanceof AzuraCastError ? error.status : 500).json({ connected: false, error: error instanceof AzuraCastError ? error.message : 'Error interno del servidor.' }); }
};

api.get('/health', (_req, res) => res.json({ status: 'online' }));
api.get('/azuracast/status', azuraRoute('getStatus'));
api.get('/azuracast/now-playing', azuraRoute('getNowPlaying'));
api.get('/azuracast/station', azuraRoute('getStation'));
api.get('/azuracast/history', azuraRoute('getHistory'));
api.get('/azuracast/listeners', azuraRoute('getListeners'));
api.get('/azuracast/media', azuraRoute('getMediaLibrary'));
api.get('/cartwall', async (_req, res, next) => { try { res.json(await all('SELECT * FROM cartwall ORDER BY id')); } catch (error) { next(error); } });
api.put('/cartwall/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id); const { label, color, audioPath } = req.body;
    if (!Number.isInteger(id) || id < 1 || id > 20 || !label?.trim()) return res.status(400).json({ error: 'Datos de cartuchera inválidos.' });
    await run('UPDATE cartwall SET label = ?, color = ?, audio_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [label.trim(), color || 'cyan', audioPath || null, id]);
    res.json((await all('SELECT * FROM cartwall WHERE id = ?', [id]))[0]);
  } catch (error) { next(error); }
});
api.get('/dashboard', async (_req, res, next) => {
  try {
    const cartwall = await all('SELECT id, label, color, audio_path AS audioPath, hotkey FROM cartwall ORDER BY id');
    try { res.json({ ...(await azuraCastService.getDashboard()), cartwall }); }
    catch (error) { res.json({ azuracast: { connected: false, online: false, autoDj: false, error: error.message }, listeners: 0, nowPlaying: null, next: null, cartwall }); }
  } catch (error) { next(error); }
});