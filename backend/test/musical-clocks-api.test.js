import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';

process.env.DATABASE_PATH = path.join(tmpdir(), `ptr-radio-clocks-${randomUUID()}.db`);
const { initializeDatabase } = await import('../src/database.js');
const { app } = await import('../src/app.js');
await initializeDatabase();
const server = app.listen(0, '127.0.0.1');
await new Promise(resolve => server.once('listening', resolve));
const root = `http://127.0.0.1:${server.address().port}/api`;
test.after(() => new Promise(resolve => server.close(resolve)));

async function request(pathname, options = {}) {
  const response = await fetch(`${root}${pathname}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  return { status: response.status, body: await response.json() };
}

test('incluye tres relojes de demostracion con sus posiciones', async () => {
  const result = await request('/musical-clocks');
  assert.equal(result.status, 200);
  assert.equal(result.body.length, 3);
  const clock = await request(`/musical-clocks/${result.body[0].id}`);
  assert.ok(clock.body.items.length > 0);
  assert.equal(clock.body.items[0].position, 0);
});

test('ejecuta CRUD de reloj, posiciones, duplicado y reordenamiento', async () => {
  const created = await request('/musical-clocks', { method: 'POST', body: JSON.stringify({ name: 'Reloj de prueba', targetDuration: 3600, color: '#22d3ee' }) });
  assert.equal(created.status, 201);
  const id = created.body.id;
  const first = await request(`/musical-clocks/${id}/items`, { method: 'POST', body: JSON.stringify({ name: 'Jingle inicial', type: 'Jingle', estimatedDuration: 12, color: '#8b5cf6' }) });
  const second = await request(`/musical-clocks/${id}/items`, { method: 'POST', body: JSON.stringify({ name: 'Espacio musical', type: 'Categoria musical', estimatedDuration: 180, color: '#22d3ee' }) });
  // El API usa las etiquetas con acentos; una categoria invalida debe rechazarse.
  assert.equal(second.status, 400);
  const validSecond = await request(`/musical-clocks/${id}/items`, { method: 'POST', body: JSON.stringify({ name: 'Comercial', type: 'Comercial', estimatedDuration: 30, color: '#f59e0b' }) });
  assert.equal(first.status, 201); assert.equal(validSecond.status, 201);
  const updated = await request(`/musical-clocks/${id}/items/${first.body.id}`, { method: 'PUT', body: JSON.stringify({ estimatedDuration: 15 }) });
  assert.equal(updated.body.estimatedDuration, 15);
  const reordered = await request(`/musical-clocks/${id}/reorder`, { method: 'PUT', body: JSON.stringify({ itemIds: [validSecond.body.id, first.body.id] }) });
  assert.deepEqual(reordered.body.map(item => item.id), [validSecond.body.id, first.body.id]);
  const copiedItem = await request(`/musical-clocks/${id}/items/${first.body.id}/duplicate`, { method: 'POST', body: '{}' });
  assert.equal(copiedItem.status, 201);
  assert.equal((await request(`/musical-clocks/${id}/items/${copiedItem.body.id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await request(`/musical-clocks/${id}`, { method: 'PUT', body: JSON.stringify({ description: 'Actualizado' }) })).body.description, 'Actualizado');
  assert.equal((await request(`/musical-clocks/${id}/status`, { method: 'PATCH', body: JSON.stringify({ active: false }) })).body.active, false);
  const copy = await request(`/musical-clocks/${id}/duplicate`, { method: 'POST', body: '{}' });
  assert.equal(copy.status, 201); assert.equal(copy.body.items.length, 2);
  await request(`/musical-clocks/${copy.body.id}`, { method: 'DELETE' });
  assert.equal((await request(`/musical-clocks/${id}`, { method: 'DELETE' })).status, 200);
  assert.equal((await request(`/musical-clocks/${id}`)).status, 404);
});

test('asocia un reloj con Programacion y protege su eliminacion', async () => {
  const clocks = await request('/musical-clocks'); const id = clocks.body[0].id;
  const block = await request('/schedule', { method: 'POST', body: JSON.stringify({ name: 'Bloque con reloj', dayOfWeek: 6, startTime: '20:00', endTime: '21:00', type: 'Programa', color: '#22d3ee', musicalClockId: id }) });
  assert.equal(block.status, 201); assert.equal(block.body.musicalClockId, id);
  const detail = await request(`/musical-clocks/${id}`);
  assert.ok(detail.body.scheduleBlocks.some(item => item.id === block.body.id));
  const protectedResult = await request(`/musical-clocks/${id}`, { method: 'DELETE' });
  assert.equal(protectedResult.status, 409); assert.equal(protectedResult.body.scheduleBlocks[0].id, block.body.id);
  await request(`/schedule/${block.body.id}`, { method: 'DELETE' });
});

test('rechaza datos invalidos y ordenes incompletos', async () => {
  assert.equal((await request('/musical-clocks', { method: 'POST', body: JSON.stringify({ name: '', targetDuration: 0 }) })).status, 400);
  const clocks = await request('/musical-clocks');
  assert.equal((await request(`/musical-clocks/${clocks.body[0].id}/reorder`, { method: 'PUT', body: JSON.stringify({ itemIds: [] }) })).status, 400);
});
