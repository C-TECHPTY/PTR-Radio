const TYPES = ['Programa', 'Playlist', 'Música', 'Comercial', 'Jingle', 'DJ Virtual', 'Evento especial'];
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export class ScheduleValidationError extends Error {
  constructor(message, details = {}) { super(message); this.name = 'ScheduleValidationError'; this.status = 400; this.details = details; }
}
export class ScheduleConflictError extends Error {
  constructor(conflicts) { super('El bloque se cruza con otra programación.'); this.name = 'ScheduleConflictError'; this.status = 409; this.conflicts = conflicts; }
}
export class ScheduleNotFoundError extends Error {
  constructor() { super('Bloque de programación no encontrado.'); this.name = 'ScheduleNotFoundError'; this.status = 404; }
}

const toDto = (row) => row ? ({ id: row.id, name: row.name, dayOfWeek: row.day_of_week, startTime: row.start_time, endTime: row.end_time, type: row.type, color: row.color, description: row.description, active: Boolean(row.active), mediaId: row.media_id, playlistName: row.playlist_name, createdAt: row.created_at, updatedAt: row.updated_at }) : null;

export class ScheduleService {
  constructor(database) { this.db = database; }
  normalize(input = {}, existing = {}) {
    const value = {
      name: String(input.name ?? existing.name ?? '').trim(),
      dayOfWeek: Number(input.dayOfWeek ?? existing.dayOfWeek),
      startTime: String(input.startTime ?? existing.startTime ?? ''),
      endTime: String(input.endTime ?? existing.endTime ?? ''),
      type: String(input.type ?? existing.type ?? ''),
      color: String(input.color ?? existing.color ?? '#22d3ee'),
      description: String(input.description ?? existing.description ?? '').trim(),
      active: input.active === undefined ? (existing.active ?? true) : Boolean(input.active),
      mediaId: input.mediaId === undefined ? (existing.mediaId ?? null) : (input.mediaId || null),
      playlistName: input.playlistName === undefined ? (existing.playlistName ?? null) : (input.playlistName || null),
    };
    const errors = {};
    if (!value.name) errors.name = 'El nombre es obligatorio.';
    if (!Number.isInteger(value.dayOfWeek) || value.dayOfWeek < 0 || value.dayOfWeek > 6) errors.dayOfWeek = 'El día debe estar entre lunes y domingo.';
    if (!TIME_PATTERN.test(value.startTime)) errors.startTime = 'La hora inicial debe usar formato 24 horas.';
    if (!TIME_PATTERN.test(value.endTime)) errors.endTime = 'La hora final debe usar formato 24 horas.';
    if (TIME_PATTERN.test(value.startTime) && TIME_PATTERN.test(value.endTime) && value.endTime <= value.startTime) errors.endTime = 'La hora final debe ser mayor que la inicial; los bloques no pueden cruzar de día.';
    if (!TYPES.includes(value.type)) errors.type = 'El tipo de bloque no es válido.';
    if (!/^#[0-9a-f]{6}$/i.test(value.color)) errors.color = 'El color debe usar formato hexadecimal.';
    if (value.type === 'Música' && !value.mediaId) errors.mediaId = 'Selecciona una pista musical.';
    if (value.type === 'Playlist' && !value.playlistName) errors.playlistName = 'Selecciona una playlist.';
    if (Object.keys(errors).length) throw new ScheduleValidationError('Revisa los campos obligatorios.', errors);
    if (value.type !== 'Música') value.mediaId = null;
    if (value.type !== 'Playlist') value.playlistName = null;
    return value;
  }
  async list() { return (await this.db.all('SELECT * FROM schedule_blocks ORDER BY day_of_week, start_time, name')).map(toDto); }
  async get(id) { const row = (await this.db.all('SELECT * FROM schedule_blocks WHERE id = ?', [id]))[0]; if (!row) throw new ScheduleNotFoundError(); return toDto(row); }
  async conflicts(value, excludeId = null) {
    if (!value.active) return [];
    const params = [value.dayOfWeek, value.endTime, value.startTime];
    let sql = `SELECT * FROM schedule_blocks WHERE active = 1 AND day_of_week = ? AND start_time < ? AND end_time > ?`;
    if (excludeId !== null) { sql += ' AND id != ?'; params.push(excludeId); }
    return (await this.db.all(sql, params)).map(toDto);
  }
  async create(input) {
    const value = this.normalize(input); const conflicts = await this.conflicts(value);
    if (conflicts.length && input.allowConflict !== true) throw new ScheduleConflictError(conflicts);
    const result = await this.db.run(`INSERT INTO schedule_blocks (name, day_of_week, start_time, end_time, type, color, description, active, media_id, playlist_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [value.name, value.dayOfWeek, value.startTime, value.endTime, value.type, value.color, value.description, value.active ? 1 : 0, value.mediaId, value.playlistName]);
    return this.get(result.id);
  }
  async update(id, input) {
    const existing = await this.get(id); const value = this.normalize(input, existing); const conflicts = await this.conflicts(value, id);
    if (conflicts.length && input.allowConflict !== true) throw new ScheduleConflictError(conflicts);
    await this.db.run(`UPDATE schedule_blocks SET name=?, day_of_week=?, start_time=?, end_time=?, type=?, color=?, description=?, active=?, media_id=?, playlist_name=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`, [value.name, value.dayOfWeek, value.startTime, value.endTime, value.type, value.color, value.description, value.active ? 1 : 0, value.mediaId, value.playlistName, id]);
    return this.get(id);
  }
  async remove(id) { await this.get(id); await this.db.run('DELETE FROM schedule_blocks WHERE id = ?', [id]); return { deleted: true, id }; }
  async duplicate(id, input = {}) { const source = await this.get(id); return this.create({ ...source, name: input.name || `${source.name} (copia)`, dayOfWeek: input.dayOfWeek ?? source.dayOfWeek, startTime: input.startTime || source.startTime, endTime: input.endTime || source.endTime, active: input.active ?? false, allowConflict: input.allowConflict }); }
  async setStatus(id, active) { if (typeof active !== 'boolean') throw new ScheduleValidationError('El estado activo es obligatorio.', { active: 'Usa true o false.' }); return this.update(id, { active }); }
}

export const scheduleTypes = TYPES;
