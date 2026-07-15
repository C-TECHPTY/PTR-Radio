import fs from 'node:fs';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
const db = new sqlite3.Database(config.databasePath);

export function run(sql, params = []) { return new Promise((resolve, reject) => db.run(sql, params, function (error) { error ? reject(error) : resolve({ id: this.lastID, changes: this.changes }); })); }
export function all(sql, params = []) { return new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows))); }

export async function initializeDatabase() {
  await run(`CREATE TABLE IF NOT EXISTS cartwall (
    id INTEGER PRIMARY KEY,
    label TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'cyan',
    audio_path TEXT,
    hotkey TEXT,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  const rows = await all('SELECT id FROM cartwall LIMIT 1');
  if (!rows.length) {
    const colors = ['cyan', 'violet', 'amber', 'rose', 'emerald'];
    for (let id = 1; id <= 20; id += 1) await run('INSERT INTO cartwall (id, label, color, hotkey) VALUES (?, ?, ?, ?)', [id, `CART ${String(id).padStart(2, '0')}`, colors[(id - 1) % colors.length], `F${((id - 1) % 10) + 1}`]);
  }
  await run(`CREATE TABLE IF NOT EXISTS schedule_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    day_of_week INTEGER NOT NULL CHECK(day_of_week BETWEEN 0 AND 6),
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    type TEXT NOT NULL,
    color TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    active INTEGER NOT NULL DEFAULT 1,
    media_id TEXT,
    playlist_name TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await run('CREATE INDEX IF NOT EXISTS idx_schedule_day_time ON schedule_blocks(day_of_week, start_time, end_time)');
  const scheduleRows = await all('SELECT id FROM schedule_blocks LIMIT 1');
  if (!scheduleRows.length) {
    const seeds = [
      ['Buenos Días Panda', 0, '06:00', '08:00', 'Programa', '#22d3ee', 'Magazine para comenzar la semana.'],
      ['Salsa de Oro', 1, '08:00', '10:00', 'Música', '#f59e0b', 'Selección clásica de salsa.'],
      ['Urban Mix', 2, '10:00', '12:00', 'DJ Virtual', '#8b5cf6', 'Mezcla urbana de media mañana.'],
      ['Típica Panameña', 3, '12:00', '13:00', 'Programa', '#10b981', 'Una hora dedicada a Panamá.'],
      ['Tropical Hits', 4, '13:00', '15:00', 'Playlist', '#f43f5e', 'Éxitos tropicales para la tarde.'],
      ['Reggae Night', 4, '18:00', '20:00', 'Evento especial', '#6366f1', 'Especial de reggae para cerrar la semana.'],
    ];
    for (const block of seeds) await run(`INSERT INTO schedule_blocks
      (name, day_of_week, start_time, end_time, type, color, description)
      VALUES (?, ?, ?, ?, ?, ?, ?)`, block);
  }
}
