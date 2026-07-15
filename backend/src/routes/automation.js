import { Router } from 'express';
import { all, run } from '../database.js';
import { azuraCastService } from '../services/AzuraCastService.js';
import { AutomationService } from '../services/AutomationService.js';

export const automationService = new AutomationService({ all, run }, { mediaProvider: () => azuraCastService.getMediaLibrary() });
export const automationRouter = Router();
const handle = (action, status = 200) => async (req, res) => { try { res.status(status).json(await action(req)); } catch (error) { const body = { error: error.message || 'Error interno del motor.' }; if (error.details && Object.keys(error.details).length) body.details = error.details; res.status(error.status || 500).json(body); } };

automationRouter.get('/status', handle(() => automationService.getStatus()));
automationRouter.get('/current', handle(() => automationService.current()));
automationRouter.get('/queue', handle(() => automationService.queue()));
automationRouter.get('/history', handle(() => automationService.history()));
automationRouter.post('/generate', handle(req => automationService.generate(req.body), 201));
automationRouter.post('/regenerate', handle(req => automationService.regenerate(req.body), 201));
automationRouter.post('/start-simulation', handle(req => automationService.start(req.body)));
automationRouter.post('/pause', handle(() => automationService.pause()));
automationRouter.post('/resume', handle(req => automationService.resume(req.body)));
automationRouter.post('/stop', handle(() => automationService.stop()));
automationRouter.post('/skip', handle(() => automationService.skip()));
automationRouter.post('/clear', handle(() => automationService.clear()));
automationRouter.patch('/queue/:id/status', handle(req => automationService.setQueueStatus(Number(req.params.id), req.body.status)));
