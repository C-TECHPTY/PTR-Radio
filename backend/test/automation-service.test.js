import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';

process.env.DATABASE_PATH = path.join(tmpdir(), `ptr-radio-automation-${randomUUID()}.db`);
const database = await import('../src/database.js');
const { AutomationService } = await import('../src/services/AutomationService.js');
await database.initializeDatabase();
const tracks = [
  { id: 1, title: 'Salsa Uno', artist: 'Orquesta A', genre: 'Salsa', duration: 180, playlists: [{name:'Salsa'}] },
  { id: 2, title: 'Salsa Dos', artist: 'Orquesta B', genre: 'Salsa', duration: 200, playlists: [{name:'Salsa'}] },
  { id: 3, title: 'Salsa Tres', artist: 'Orquesta A', genre: 'Salsa', duration: 190, playlists: [{name:'Salsa'}] },
];
const service = new AutomationService(database, { mediaProvider: async () => tracks, random: () => 0, tickMs: 100000 });
const block = (await database.all("SELECT * FROM schedule_blocks WHERE name LIKE 'Salsa%' LIMIT 1"))[0];
const clock = (await database.all("SELECT * FROM musical_clocks WHERE name LIKE 'Salsa%' LIMIT 1"))[0];
await database.run('UPDATE schedule_blocks SET musical_clock_id=? WHERE id=?',[clock.id,block.id]);
await database.run("UPDATE musical_clock_items SET artist_separation_minutes=60,track_separation_minutes=120 WHERE clock_id=? AND type LIKE '%Categor%'",[clock.id]);

test.after(() => service.clearTimer());

test('genera una cola ordenada sin repetir pistas y conserva fallbacks', async () => {
  const generated = await service.generate({scheduleBlockId:block.id,musicalClockId:clock.id,testDateTime:'2026-07-15T08:00:00-05:00'});
  const queue = await service.queue();
  assert.equal(generated.status,'prepared'); assert.ok(queue.length>3);
  assert.deepEqual(queue.map(item=>item.position),queue.map((_,index)=>index));
  const mediaIds=queue.map(item=>item.mediaId).filter(Boolean); assert.equal(new Set(mediaIds).size,mediaIds.length);
  const artists=queue.map(item=>item.artist).filter(Boolean); assert.equal(new Set(artists).size,artists.length);
  assert.ok(queue.some(item=>item.status==='pending'));
  assert.ok(queue.every(item=>item.duration>=0));
});

test('simula, pausa, reanuda, salta y guarda historial persistentemente', async () => {
  await service.start({speed:20});
  assert.equal((await service.getStatus()).status,'simulating');
  await service.advance(20);
  await service.pause(); assert.equal((await service.getStatus()).status,'paused');
  await service.resume({speed:5}); assert.equal((await service.getStatus()).run.speed,5);
  await service.skip(); assert.ok((await service.history()).some(item=>item.result==='skipped'));
  await service.pause();
  const recovered=new AutomationService(database,{mediaProvider:async()=>tracks});
  assert.equal((await recovered.getStatus()).status,'paused');
  assert.ok((await recovered.queue()).length>0);
  await recovered.stop();
});

test('maneja biblioteca vacía y valida bloque y reloj', async () => {
  const empty=new AutomationService(database,{mediaProvider:async()=>[]});
  const generated=await empty.generate({scheduleBlockId:block.id,musicalClockId:clock.id});
  assert.ok(generated.warnings.some(value=>value.includes('contenido musical')));
  await assert.rejects(empty.generate({scheduleBlockId:99999,musicalClockId:clock.id}),/no existe/);
  await empty.clear();
});
