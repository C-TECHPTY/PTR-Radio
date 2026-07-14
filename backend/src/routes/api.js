import { Router } from 'express';
import { all, run } from '../database.js';
import { getAzuraCastStatus } from '../services/azuracast.js';

export const api = Router();
api.get('/health', (_req, res) => res.json({ status: 'online' }));
api.get('/azuracast/status', async (_req, res) => res.json(await getAzuraCastStatus()));
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
    const [azuracast, cartwall] = await Promise.all([getAzuraCastStatus(), all('SELECT id, label, color, audio_path AS audioPath, hotkey FROM cartwall ORDER BY id')]);
    res.json({
      azuracast, listeners: azuracast.listeners,
      nowPlaying: azuracast.nowPlaying || { title: 'PTR Radio Automation', artist: 'Sistema listo para operar', elapsed: 47, duration: 214 },
      next: azuracast.next || { title: 'Configura tu estación', artist: 'AzuraCast API' }, cartwall,
    });
  } catch (error) { next(error); }
});
