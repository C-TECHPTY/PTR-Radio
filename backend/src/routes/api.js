import { Router } from 'express';
import { all } from '../database.js';
import { AzuraCastError, azuraCastService } from '../services/AzuraCastService.js';
import { scheduleRouter } from './schedule.js';
import { musicalClocksRouter } from './musical-clocks.js';
import { cartwallRouter } from './cartwall.js';

export const api = Router();
const azuraRoute = (method) => async (_req, res) => {
  try { res.json(await azuraCastService[method]()); }
  catch (error) { res.status(error instanceof AzuraCastError ? error.status : 500).json({ connected: false, error: error instanceof AzuraCastError ? error.message : 'Error interno del servidor.' }); }
};

api.get('/health', (_req, res) => res.json({ status: 'online' }));
api.use('/schedule', scheduleRouter);
api.use('/musical-clocks', musicalClocksRouter);
api.use('/cartwall', cartwallRouter);
api.get('/azuracast/status', azuraRoute('getStatus'));
api.get('/azuracast/now-playing', azuraRoute('getNowPlaying'));
api.get('/azuracast/station', azuraRoute('getStation'));
api.get('/azuracast/history', azuraRoute('getHistory'));
api.get('/azuracast/listeners', azuraRoute('getListeners'));
api.get('/azuracast/media', azuraRoute('getMediaLibrary'));
api.get('/dashboard', async (_req, res, next) => {
  try {
    const cartwall = await all('SELECT id, slot_number AS slotNumber, name AS label, color, audio_url AS audioUrl, hotkey, active FROM cartwall_buttons ORDER BY slot_number');
    try { res.json({ ...(await azuraCastService.getDashboard()), cartwall }); }
    catch (error) { res.json({ azuracast: { connected: false, online: false, autoDj: false, error: error.message }, listeners: 0, nowPlaying: null, next: null, cartwall }); }
  } catch (error) { next(error); }
});
