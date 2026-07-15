import { Router } from 'express';
import { all, run } from '../database.js';
import { LiveAssistService } from '../services/LiveAssistService.js';

export const liveAssistService=new LiveAssistService({all,run});
export const liveAssistRouter=Router();
export const savedPlaylistsRouter=Router();
const handle=(action,status=200)=>async(req,res)=>{try{res.status(status).json(await action(req));}catch(error){const body={error:error.message||'Error interno de Live Assist.'};if(error.details&&Object.keys(error.details).length)body.details=error.details;res.status(error.status||500).json(body);}};

liveAssistRouter.get('/queue',handle(()=>liveAssistService.getQueue()));
liveAssistRouter.patch('/queue',handle(req=>liveAssistService.configure(req.body)));
liveAssistRouter.post('/queue/items',handle(req=>liveAssistService.addItem(req.body),201));
liveAssistRouter.put('/queue/items/:id',handle(req=>liveAssistService.updateItem(Number(req.params.id),req.body)));
liveAssistRouter.delete('/queue/items/:id',handle(req=>liveAssistService.removeItem(Number(req.params.id))));
liveAssistRouter.post('/queue/items/:id/duplicate',handle(req=>liveAssistService.duplicate(Number(req.params.id)),201));
liveAssistRouter.post('/queue/reorder',handle(req=>liveAssistService.reorder(req.body.itemIds)));
liveAssistRouter.post('/queue/next',handle(req=>liveAssistService.next(req.body)));
liveAssistRouter.post('/queue/clear',handle(()=>liveAssistService.clear()));
liveAssistRouter.patch('/queue/items/:id/status',handle(req=>liveAssistService.setStatus(Number(req.params.id),req.body.status,req.body)));
liveAssistRouter.get('/history',handle(()=>liveAssistService.history()));

savedPlaylistsRouter.get('/',handle(()=>liveAssistService.listPlaylists()));
savedPlaylistsRouter.get('/:id',handle(req=>liveAssistService.getPlaylist(Number(req.params.id))));
savedPlaylistsRouter.post('/',handle(req=>liveAssistService.createPlaylist(req.body),201));
savedPlaylistsRouter.put('/:id',handle(req=>liveAssistService.updatePlaylist(Number(req.params.id),req.body)));
savedPlaylistsRouter.delete('/:id',handle(req=>liveAssistService.deletePlaylist(Number(req.params.id))));
savedPlaylistsRouter.post('/:id/duplicate',handle(req=>liveAssistService.duplicatePlaylist(Number(req.params.id)),201));
savedPlaylistsRouter.post('/:id/load',handle(req=>liveAssistService.loadPlaylist(Number(req.params.id))));
