import fs from 'node:fs';
import path from 'node:path';
import sqlite3 from 'sqlite3';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });
const db = new sqlite3.Database(config.databasePath);

export function run(sql, params = []) { return new Promise((resolve, reject) => db.run(sql, params, function (error) { error ? reject(error) : resolve({ id: this.lastID, changes: this.changes }); })); }
export function all(sql, params = []) { return new Promise((resolve, reject) => db.all(sql, params, (error, rows) => error ? reject(error) : resolve(rows))); }

const repairText = (value) => {
  if (typeof value !== 'string') return value;
  const replacements = [
    ['\u00c3\u00a1', 'á'], ['\u00c3\u00a9', 'é'], ['\u00c3\u00ad', 'í'], ['\u00c3\u00b3', 'ó'], ['\u00c3\u00ba', 'ú'], ['\u00c3\u00b1', 'ñ'],
    ['\u00c3\u0081', 'Á'], ['\u00c3\u0089', 'É'], ['\u00c3\u008d', 'Í'], ['\u00c3\u0093', 'Ó'], ['\u00c3\u009a', 'Ú'], ['\u00c3\u0091', 'Ñ'],
    ['\u00c2\u00b7', '·'], ['\u00c2\u00bf', '¿'], ['\u00c2\u00a1', '¡'], ['\u00e2\u20ac\u201d', '—'], ['\u00e2\u20ac\u201c', '–'],
  ];
  return replacements.reduce((text, [bad, good]) => text.replaceAll(bad, good), value);
};

async function repairStoredText() {
  const targets = [
    ['schedule_blocks', ['name', 'type', 'description']],
    ['musical_clocks', ['name', 'description']],
    ['musical_clock_items', ['name', 'type', 'genre', 'category', 'script_template']],
    ['cartwall_buttons', ['name', 'description', 'type']],
  ];
  for (const [table, columns] of targets) {
    const rows = await all(`SELECT id, ${columns.join(', ')} FROM ${table}`);
    for (const row of rows) {
      const repaired = columns.map((column) => repairText(row[column]));
      if (columns.some((column, index) => repaired[index] !== row[column])) await run(`UPDATE ${table} SET ${columns.map((column) => `${column}=?`).join(', ')}, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [...repaired, row.id]);
    }
  }
}

export async function initializeDatabase() {
  await run('PRAGMA foreign_keys = ON');
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
  await run(`CREATE TABLE IF NOT EXISTS cartwall_buttons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slot_number INTEGER NOT NULL UNIQUE CHECK(slot_number BETWEEN 1 AND 20),
    name TEXT NOT NULL DEFAULT '', description TEXT NOT NULL DEFAULT '',
    type TEXT NOT NULL DEFAULT 'Otro', color TEXT NOT NULL DEFAULT '#22d3ee',
    hotkey TEXT UNIQUE, media_id TEXT, audio_url TEXT,
    duration REAL NOT NULL DEFAULT 0, volume REAL NOT NULL DEFAULT 1,
    fade_in REAL NOT NULL DEFAULT 0, fade_out REAL NOT NULL DEFAULT 0,
    loop INTEGER NOT NULL DEFAULT 0, allow_overlap INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  const buttonRows = await all('SELECT id FROM cartwall_buttons LIMIT 1');
  if (!buttonRows.length) {
    const examples = [
      ['ID Panda Radio','Identidad principal de la emisora','ID de emisora','#22d3ee'],
      ['Jingle Tropical','Jingle tropical de demostración','Jingle','#8b5cf6'],
      ['Comercial Demo','Espacio comercial de demostración','Comercial','#f59e0b'],
      ['Sweep Urbano','Transición urbana de demostración','Sweep','#ec4899'],
      ['Hora Exacta','Identificador de hora','Hora','#10b981'],
    ];
    const hotkeys = [...Array.from({length:12},(_,index)=>`F${index+1}`),...Array.from({length:8},(_,index)=>`Shift+F${index+1}`)];
    for (let slot = 1; slot <= 20; slot += 1) {
      const example = examples[slot - 1] || [`CART ${String(slot).padStart(2,'0')}`,'','Otro','#334155'];
      await run('INSERT INTO cartwall_buttons (slot_number,name,description,type,color,hotkey,active) VALUES (?,?,?,?,?,?,?)',[slot,...example,hotkeys[slot-1],slot <= 5 ? 1 : 0]);
    }
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
  await run(`CREATE TABLE IF NOT EXISTS musical_clocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    target_duration INTEGER NOT NULL DEFAULT 3600,
    color TEXT NOT NULL DEFAULT '#22d3ee',
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await run(`CREATE TABLE IF NOT EXISTS musical_clock_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    clock_id INTEGER NOT NULL REFERENCES musical_clocks(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    estimated_duration INTEGER NOT NULL DEFAULT 0,
    color TEXT NOT NULL DEFAULT '#22d3ee',
    required INTEGER NOT NULL DEFAULT 1,
    skip_if_unavailable INTEGER NOT NULL DEFAULT 0,
    fade_in REAL NOT NULL DEFAULT 0,
    fade_out REAL NOT NULL DEFAULT 0,
    overlap REAL NOT NULL DEFAULT 0,
    media_id TEXT,
    playlist_name TEXT,
    genre TEXT,
    category TEXT,
    artist_separation_minutes INTEGER NOT NULL DEFAULT 0,
    track_separation_minutes INTEGER NOT NULL DEFAULT 0,
    song_count INTEGER NOT NULL DEFAULT 1,
    voice_profile_id TEXT,
    script_template TEXT,
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await run('CREATE INDEX IF NOT EXISTS idx_clock_items_order ON musical_clock_items(clock_id, position)');
  await run(`CREATE TABLE IF NOT EXISTS automation_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_block_id INTEGER REFERENCES schedule_blocks(id) ON DELETE SET NULL,
    musical_clock_id INTEGER REFERENCES musical_clocks(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'prepared',
    started_at TEXT, ended_at TEXT,
    simulated_speed INTEGER NOT NULL DEFAULT 1,
    current_item_id INTEGER,
    simulated_elapsed REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await run(`CREATE TABLE IF NOT EXISTS automation_queue_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL REFERENCES automation_runs(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    item_type TEXT NOT NULL,
    source_clock_item_id INTEGER,
    media_id TEXT,
    cartwall_button_id INTEGER,
    title TEXT NOT NULL,
    artist TEXT NOT NULL DEFAULT '',
    duration REAL NOT NULL,
    scheduled_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ready',
    warnings_json TEXT NOT NULL DEFAULT '[]',
    metadata_json TEXT NOT NULL DEFAULT '{}',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(run_id, position)
  )`);
  await run(`CREATE TABLE IF NOT EXISTS automation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL REFERENCES automation_runs(id) ON DELETE CASCADE,
    queue_item_id INTEGER REFERENCES automation_queue_items(id) ON DELETE SET NULL,
    planned_at TEXT NOT NULL,
    simulated_at TEXT NOT NULL,
    result TEXT NOT NULL,
    warnings_json TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`);
  await run('CREATE INDEX IF NOT EXISTS idx_automation_queue ON automation_queue_items(run_id, position)');
  await run('CREATE INDEX IF NOT EXISTS idx_automation_history ON automation_history(run_id, created_at)');
  const scheduleColumns = await all('PRAGMA table_info(schedule_blocks)');
  if (!scheduleColumns.some((column) => column.name === 'musical_clock_id')) await run('ALTER TABLE schedule_blocks ADD COLUMN musical_clock_id INTEGER');
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
  const clockRows = await all('SELECT id FROM musical_clocks LIMIT 1');
  if (!clockRows.length) {
    const clockSeeds = [
      { name: 'Salsa Comercial 60', description: 'Reloj comercial de salsa.', color: '#f59e0b', items: [['Jingle','Jingle',15],['2 canciones Salsa','Categoría musical',420],['ID','ID de emisora',10],['2 canciones Salsa','Categoría musical',420],['Comercial','Comercial',180],['DJ Virtual','Locución DJ Virtual',25],['2 canciones Salsa','Categoría musical',420]] },
      { name: 'Urban Mix 60', description: 'Rotación urbana de una hora.', color: '#8b5cf6', items: [['Intro','Evento',20],['3 canciones Urbanas','Categoría musical',630],['Sweep','Sweep',8],['2 canciones Urbanas','Categoría musical',420],['Comercial','Comercial',180],['DJ Virtual','Locución DJ Virtual',25],['2 canciones Urbanas','Categoría musical',420]] },
      { name: 'Típica Panamá 60', description: 'Música típica y elementos de identidad.', color: '#10b981', items: [['Jingle típico','Jingle',15],['2 canciones Típicas','Categoría musical',420],['ID','ID de emisora',10],['2 canciones Típicas','Categoría musical',420],['Comercial','Comercial',180],['Hora','Hora',8],['2 canciones Típicas','Categoría musical',420]] },
    ];
    for (const clock of clockSeeds) {
      const result = await run('INSERT INTO musical_clocks (name, description, target_duration, color) VALUES (?, ?, 3600, ?)', [clock.name, clock.description, clock.color]);
      for (const [position, item] of clock.items.entries()) {
        const [name, type, duration] = item; const genre = name.includes('Salsa') ? 'Salsa' : name.includes('Urban') ? 'Urbano' : name.includes('Típica') ? 'Típica' : null; const songCount = Number(name.match(/^\d+/)?.[0] || 1);
        await run(`INSERT INTO musical_clock_items (clock_id, position, name, type, estimated_duration, color, genre, category, song_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [result.id, position, name, type, duration, clock.color, genre, genre ? 'A' : null, songCount]);
      }
    }
  }
  await repairStoredText();
}
