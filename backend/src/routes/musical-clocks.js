import { Router } from 'express';
import { all, run } from '../database.js';
import { ClockAssignedError, MusicalClockService, musicalClockItemTypes } from '../services/MusicalClockService.js';

const service=new MusicalClockService({all,run}); export const musicalClocksRouter=Router();
const handle=(action,status=200)=>async(req,res)=>{try{res.status(status).json(await action(req));}catch(error){const body={error:error.message||'Error interno del servidor.'};if(error.details&&Object.keys(error.details).length)body.details=error.details;if(error instanceof ClockAssignedError)body.scheduleBlocks=error.blocks;res.status(error.status||500).json(body);}};
musicalClocksRouter.get('/',handle(()=>service.list()));
musicalClocksRouter.get('/item-types',(_req,res)=>res.json(musicalClockItemTypes));
musicalClocksRouter.get('/:id',handle(req=>service.get(Number(req.params.id))));
musicalClocksRouter.post('/',handle(req=>service.create(req.body),201));
musicalClocksRouter.put('/:id',handle(req=>service.update(Number(req.params.id),req.body)));
musicalClocksRouter.delete('/:id',handle(req=>service.remove(Number(req.params.id),req.query.force==='true')));
musicalClocksRouter.post('/:id/duplicate',handle(req=>service.duplicate(Number(req.params.id),req.body),201));
musicalClocksRouter.patch('/:id/status',handle(req=>service.setStatus(Number(req.params.id),req.body.active)));
musicalClocksRouter.post('/:id/items',handle(req=>service.addItem(Number(req.params.id),req.body),201));
musicalClocksRouter.put('/:id/items/:itemId',handle(req=>service.updateItem(Number(req.params.id),Number(req.params.itemId),req.body)));
musicalClocksRouter.delete('/:id/items/:itemId',handle(req=>service.removeItem(Number(req.params.id),Number(req.params.itemId))));
musicalClocksRouter.post('/:id/items/:itemId/duplicate',handle(req=>service.duplicateItem(Number(req.params.id),Number(req.params.itemId)),201));
musicalClocksRouter.put('/:id/reorder',handle(req=>service.reorder(Number(req.params.id),req.body.itemIds)));
