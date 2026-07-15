import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';

process.env.DATABASE_PATH = path.join(tmpdir(), `ptr-radio-schedule-${randomUUID()}.db`);
const { initializeDatabase } = await import('../src/database.js');
const { app } = await import('../src/app.js');
await initializeDatabase();
const server = app.listen(0, '127.0.0.1');
await new Promise((resolve) => server.once('listening', resolve));
const baseUrl = `http://127.0.0.1:${server.address().port}/api/schedule`;

test.after(() => new Promise((resolve) => server.close(resolve)));
const request = async (pathName = '', options = {}) => {
  const response = await fetch(`${baseUrl}${pathName}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  return { status: response.status, body: await response.json() };
};

test('incluye seis bloques de demostración', async () => {
  const result = await request();
  assert.equal(result.status, 200);
  assert.equal(result.body.length, 6);
  assert.ok(result.body.some((block) => block.name === 'Buenos Días Panda'));
});

test('ejecuta el ciclo CRUD completo', async () => {
  const created = await request('', { method: 'POST', body: JSON.stringify({ name: 'Especial dominical', dayOfWeek: 6, startTime: '20:00', endTime: '21:00', type: 'Programa', color: '#22d3ee', description: 'Prueba CRUD', active: true }) });
  assert.equal(created.status, 201); const id = created.body.id;

  const found = await request(`/${id}`);
  assert.equal(found.status, 200); assert.equal(found.body.name, 'Especial dominical');

  const updated = await request(`/${id}`, { method: 'PUT', body: JSON.stringify({ name: 'Especial actualizado', endTime: '21:30' }) });
  assert.equal(updated.status, 200); assert.equal(updated.body.endTime, '21:30');

  const disabled = await request(`/${id}/status`, { method: 'PATCH', body: JSON.stringify({ active: false }) });
  assert.equal(disabled.status, 200); assert.equal(disabled.body.active, false);

  const duplicated = await request(`/${id}/duplicate`, { method: 'POST', body: JSON.stringify({ dayOfWeek: 5 }) });
  assert.equal(duplicated.status, 201); assert.match(duplicated.body.name, /copia/); assert.equal(duplicated.body.active, false);

  const removedCopy = await request(`/${duplicated.body.id}`, { method: 'DELETE' });
  assert.equal(removedCopy.status, 200); assert.equal(removedCopy.body.deleted, true);
  const removed = await request(`/${id}`, { method: 'DELETE' });
  assert.equal(removed.status, 200);
  assert.equal((await request(`/${id}`)).status, 404);
});

test('detecta cruces y solo permite guardarlos con confirmación', async () => {
  const payload = { name: 'Cruce intencional', dayOfWeek: 0, startTime: '07:00', endTime: '09:00', type: 'Comercial', color: '#f43f5e', active: true };
  const rejected = await request('', { method: 'POST', body: JSON.stringify(payload) });
  assert.equal(rejected.status, 409); assert.ok(rejected.body.conflicts.some((block) => block.name === 'Buenos Días Panda'));

  const accepted = await request('', { method: 'POST', body: JSON.stringify({ ...payload, allowConflict: true }) });
  assert.equal(accepted.status, 201);
  await request(`/${accepted.body.id}`, { method: 'DELETE' });
});

test('rechaza horarios inválidos y campos obligatorios ausentes', async () => {
  const result = await request('', { method: 'POST', body: JSON.stringify({ name: '', dayOfWeek: 7, startTime: '22:00', endTime: '01:00', type: 'Otro', color: 'red' }) });
  assert.equal(result.status, 400);
  assert.ok(result.body.details.name); assert.ok(result.body.details.dayOfWeek); assert.ok(result.body.details.endTime); assert.ok(result.body.details.type);
});
