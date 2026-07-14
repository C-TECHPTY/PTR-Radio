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
}
