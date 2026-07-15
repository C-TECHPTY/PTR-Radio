import { Router } from 'express';
import { all, run } from '../database.js';
import { ScheduleConflictError, ScheduleService, scheduleTypes } from '../services/ScheduleService.js';

const service = new ScheduleService({ all, run });
export const scheduleRouter = Router();
const handler = (action, success = 200) => async (req, res) => {
  try { res.status(success).json(await action(req)); }
  catch (error) {
    const payload = { error: error.message || 'Error interno del servidor.' };
    if (error.details) payload.details = error.details;
    if (error instanceof ScheduleConflictError) payload.conflicts = error.conflicts;
    res.status(error.status || 500).json(payload);
  }
};

scheduleRouter.get('/', handler(() => service.list()));
scheduleRouter.get('/types', (_req, res) => res.json(scheduleTypes));
scheduleRouter.get('/:id', handler((req) => service.get(Number(req.params.id))));
scheduleRouter.post('/', handler((req) => service.create(req.body), 201));
scheduleRouter.put('/:id', handler((req) => service.update(Number(req.params.id), req.body)));
scheduleRouter.delete('/:id', handler((req) => service.remove(Number(req.params.id))));
scheduleRouter.post('/:id/duplicate', handler((req) => service.duplicate(Number(req.params.id), req.body), 201));
scheduleRouter.patch('/:id/status', handler((req) => service.setStatus(Number(req.params.id), req.body.active)));
