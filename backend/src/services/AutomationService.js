const safeJson = (value, fallback) => { try { return JSON.parse(value || '') ?? fallback; } catch { return fallback; } };
const iso = (date) => new Date(date).toISOString();
const secondsBetween = (start, end) => { const [sh, sm] = start.split(':').map(Number); const [eh, em] = end.split(':').map(Number); return (eh * 3600 + em * 60) - (sh * 3600 + sm * 60); };
const itemDto = row => row ? ({ id: row.id, runId: row.run_id, position: row.position, type: row.item_type, sourceClockItemId: row.source_clock_item_id, mediaId: row.media_id, cartwallButtonId: row.cartwall_button_id, title: row.title, artist: row.artist, duration: row.duration, scheduledAt: row.scheduled_at, status: row.status, warnings: safeJson(row.warnings_json, []), metadata: safeJson(row.metadata_json, {}), createdAt: row.created_at, updatedAt: row.updated_at }) : null;
const runDto = row => row ? ({ id: row.id, scheduleBlockId: row.schedule_block_id, musicalClockId: row.musical_clock_id, status: row.status, startedAt: row.started_at, endedAt: row.ended_at, speed: row.simulated_speed, currentItemId: row.current_item_id, simulatedElapsed: row.simulated_elapsed, createdAt: row.created_at, updatedAt: row.updated_at }) : null;

export class AutomationError extends Error { constructor(message, status = 400, details = {}) { super(message); this.status = status; this.details = details; } }

export class AutomationService {
  constructor(database, { mediaProvider = async () => [], random = Math.random, tickMs = 1000 } = {}) { this.db = database; this.mediaProvider = mediaProvider; this.random = random; this.tickMs = tickMs; this.timer = null; }
  async latestRun() { return (await this.db.all('SELECT * FROM automation_runs ORDER BY id DESC LIMIT 1'))[0] || null; }
  async getStatus() {
    const row = await this.latestRun();
    if (!row) return { status: 'stopped', run: null, current: null, next: null, queueCount: 0, historyCount: 0 };
    const queue = await this.queue(row.id); const history = await this.history(row.id);
    const current = queue.find(item => item.id === row.current_item_id) || queue.find(item => item.status === 'playing') || null;
    const next = queue.find(item => item.position > (current?.position ?? -1) && item.status === 'ready') || null;
    return { status: row.status, run: runDto(row), current, next, queueCount: queue.length, historyCount: history.length };
  }
  async current() {
    const status = await this.getStatus(); const run = status.run;
    if (!run) return { ...status, block: null, nextBlock: null, clock: null, remaining: 0 };
    const block = (await this.db.all('SELECT * FROM schedule_blocks WHERE id=?', [run.scheduleBlockId]))[0] || null;
    const clock = (await this.db.all('SELECT * FROM musical_clocks WHERE id=?', [run.musicalClockId]))[0] || null;
    const nextBlock = block ? (await this.db.all('SELECT * FROM schedule_blocks WHERE active=1 AND day_of_week=? AND start_time>=? AND id!=? ORDER BY start_time LIMIT 1', [block.day_of_week, block.end_time, block.id]))[0] || null : null;
    return { ...status, block: this.blockDto(block), nextBlock: this.blockDto(nextBlock), clock: clock ? { id: clock.id, name: clock.name, targetDuration: clock.target_duration } : null, remaining: Math.max(0, (status.current?.duration || 0) - (run.simulatedElapsed || 0)) };
  }
  blockDto(row) { return row ? { id: row.id, name: row.name, dayOfWeek: row.day_of_week, startTime: row.start_time, endTime: row.end_time, musicalClockId: row.musical_clock_id } : null; }
  async queue(runId = null) { const run = runId ? { id: runId } : await this.latestRun(); return run ? (await this.db.all('SELECT * FROM automation_queue_items WHERE run_id=? ORDER BY position', [run.id])).map(itemDto) : []; }
  async history(runId = null) { const run = runId ? { id: runId } : await this.latestRun(); return run ? (await this.db.all('SELECT h.*,q.title,q.artist,q.duration FROM automation_history h LEFT JOIN automation_queue_items q ON q.id=h.queue_item_id WHERE h.run_id=? ORDER BY h.id DESC', [run.id])).map(row => ({ id: row.id, runId: row.run_id, queueItemId: row.queue_item_id, plannedAt: row.planned_at, simulatedAt: row.simulated_at, title: row.title, artist: row.artist, duration: row.duration, result: row.result, warnings: safeJson(row.warnings_json, []) })) : []; }
  async resolveSelection() {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Panama', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const get = type => parts.find(part => part.type === type)?.value; const day = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].indexOf(get('weekday')); const time = `${get('hour')}:${get('minute')}`;
    const block = (await this.db.all('SELECT * FROM schedule_blocks WHERE active=1 AND day_of_week=? AND start_time<=? AND end_time>? ORDER BY start_time LIMIT 1', [day, time, time]))[0];
    if (!block) throw new AutomationError('No hay un bloque activo. Selecciona uno para la simulación manual.', 409);
    return block;
  }
  async generate(input = {}) {
    const block = input.scheduleBlockId ? (await this.db.all('SELECT * FROM schedule_blocks WHERE id=?', [Number(input.scheduleBlockId)]))[0] : await this.resolveSelection();
    if (!block) throw new AutomationError('El bloque de programación no existe.', 404);
    const clockId = Number(input.musicalClockId || block.musical_clock_id); const clock = (await this.db.all('SELECT * FROM musical_clocks WHERE id=? AND active=1', [clockId]))[0];
    if (!clock) throw new AutomationError('Selecciona un reloj musical existente y activo.', 404);
    const clockItems = await this.db.all('SELECT * FROM musical_clock_items WHERE clock_id=? ORDER BY position,id', [clockId]);
    if (!clockItems.length) throw new AutomationError('El reloj musical no tiene posiciones.', 409);
    if (new Set(clockItems.map(item => item.position)).size !== clockItems.length) throw new AutomationError('El reloj contiene posiciones duplicadas.', 409);
    let media = []; try { media = await this.mediaProvider(); } catch { media = []; }
    media = media.filter(track => track && track.id != null && Number(track.duration) > 0 && (track.title || track.path));
    const base = input.testDateTime ? new Date(input.testDateTime) : new Date(); if (Number.isNaN(base.getTime())) throw new AutomationError('La fecha y hora de prueba no es válida.');
    const result = await this.db.run('INSERT INTO automation_runs (schedule_block_id,musical_clock_id,status,simulated_speed) VALUES (?,?,?,?)', [block.id, clock.id, 'prepared', this.validSpeed(input.speed || 1)]);
    const usedMedia = new Set(); const artists = new Map(); let position = 0; let elapsed = 0; const warnings = [];
    for (const source of clockItems) {
      const count = /Canci|Categor|Playlist/i.test(source.type) ? Math.max(1, source.song_count) : 1;
      for (let index = 0; index < count; index += 1) {
        const built = await this.buildItem(source, media, usedMedia, artists, elapsed);
        const duration = Number(built.duration || source.estimated_duration || 0); const scheduledAt = new Date(base.getTime() + elapsed * 1000);
        if (!Number.isFinite(duration) || duration < 0) built.warnings.push('Duración inválida; se usó 0 segundos.');
        if (built.warnings.length) warnings.push(...built.warnings.map(message => `${source.name}: ${message}`));
        const inserted = await this.db.run(`INSERT INTO automation_queue_items (run_id,position,item_type,source_clock_item_id,media_id,cartwall_button_id,title,artist,duration,scheduled_at,status,warnings_json,metadata_json) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [result.id, position, source.type, source.id, built.mediaId, built.cartwallButtonId, built.title, built.artist, Math.max(0, duration || 0), iso(scheduledAt), built.status, JSON.stringify(built.warnings), JSON.stringify({ source: built.source, clockItem: source.name })]);
        if (built.mediaId) { usedMedia.add(String(built.mediaId)); if (built.artist) artists.set(built.artist.toLowerCase(), elapsed); }
        elapsed += Math.max(0, duration - Number(source.overlap || 0)); position += 1;
      }
    }
    const first = (await this.db.all("SELECT id FROM automation_queue_items WHERE run_id=? AND status='ready' ORDER BY position LIMIT 1", [result.id]))[0];
    await this.db.run('UPDATE automation_runs SET current_item_id=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', [first?.id || null, result.id]);
    const blockDuration = secondsBetween(block.start_time, block.end_time); const difference = blockDuration - elapsed;
    return { ...(await this.getStatus()), block: this.blockDto(block), clock: { id: clock.id, name: clock.name }, totalDuration: elapsed, blockDuration, difference, fit: difference === 0 ? 'exact' : difference > 0 ? 'missing' : 'excess', warnings };
  }
  async buildItem(source, media, usedMedia, artists, elapsed) {
    const warnings = []; const musicType = /Canci|Categor|Playlist/i.test(source.type);
    if (musicType) {
      let candidates = media.filter(track => !usedMedia.has(String(track.id)));
      if (source.media_id) candidates = candidates.filter(track => String(track.id) === String(source.media_id) || String(track.uniqueId) === String(source.media_id));
      if (source.genre) candidates = candidates.filter(track => String(track.genre || '').toLowerCase().includes(String(source.genre).toLowerCase()));
      if (source.playlist_name) candidates = candidates.filter(track => (track.playlists || []).some(p => String(p.name || p).toLowerCase() === String(source.playlist_name).toLowerCase()));
      const separated = candidates.filter(track => !track.artist || !artists.has(String(track.artist).toLowerCase()) || elapsed - artists.get(String(track.artist).toLowerCase()) >= Number(source.artist_separation_minutes || 0) * 60);
      if (separated.length) candidates = separated;
      else if (candidates.length && source.artist_separation_minutes) return { title: source.name, artist: '', duration: source.estimated_duration, status: source.skip_if_unavailable ? 'skipped' : 'pending', warnings: ['No hay artistas disponibles que respeten la separación configurada.'], source: 'reloj' };
      if (!candidates.length) return { title: source.name, artist: '', duration: source.estimated_duration, status: source.skip_if_unavailable ? 'skipped' : 'pending', warnings: [...warnings, source.playlist_name ? 'La playlist no tiene contenido disponible.' : 'No hay contenido musical disponible.'], source: 'reloj' };
      const track = candidates[Math.floor(this.random() * candidates.length)];
      return { title: track.title || track.path, artist: track.artist || 'Artista desconocido', duration: Number(track.duration), mediaId: String(track.id), status: 'ready', warnings, source: source.playlist_name ? 'playlist' : 'biblioteca' };
    }
    const cartType = source.type === 'ID de emisora' ? 'ID de emisora' : source.type;
    if (['Jingle','Comercial','ID de emisora','Sweep'].includes(source.type)) {
      const button = (await this.db.all('SELECT * FROM cartwall_buttons WHERE active=1 AND type=? AND (media_id IS NOT NULL OR audio_url IS NOT NULL) ORDER BY slot_number LIMIT 1', [cartType]))[0];
      if (button) return { title: button.name, artist: '', duration: Number(button.duration || source.estimated_duration), cartwallButtonId: button.id, mediaId: button.media_id, status: 'ready', warnings, source: 'cartuchera' };
      warnings.push('No hay un cartucho activo con audio para esta posición.');
    }
    const virtual = ['Locución DJ Virtual','DJ Virtual'].includes(source.type);
    return { title: source.name, artist: '', duration: source.estimated_duration, status: virtual ? 'pending' : (source.skip_if_unavailable ? 'skipped' : 'ready'), warnings: virtual ? [...warnings, 'DJ Virtual permanece pendiente en v1.'] : warnings, source: 'reloj' };
  }
  validSpeed(value) { const speed = Number(value); if (![1,5,20,60].includes(speed)) throw new AutomationError('La velocidad debe ser x1, x5, x20 o x60.'); return speed; }
  async regenerate(input = {}) { await this.stop(false); return this.generate(input); }
  async start(input = {}) { const run = await this.latestRun(); if (!run) throw new AutomationError('Genera una cola antes de iniciar.', 409); const speed = this.validSpeed(input.speed || run.simulated_speed); if (!['prepared','paused'].includes(run.status)) throw new AutomationError('La simulación no puede iniciarse desde su estado actual.', 409); await this.db.run("UPDATE automation_runs SET status='simulating',started_at=COALESCE(started_at,CURRENT_TIMESTAMP),simulated_speed=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", [speed, run.id]); this.ensureTimer(); return this.getStatus(); }
  ensureTimer() { if (this.timer) return; this.timer = setInterval(() => this.tick().catch(() => {}), this.tickMs); this.timer.unref?.(); }
  async tick() { const run = await this.latestRun(); if (!run || run.status !== 'simulating') return this.clearTimer(); await this.advance(run.simulated_speed); }
  async advance(seconds) { const run = await this.latestRun(); if (!run || run.status !== 'simulating') return this.getStatus(); let remaining = Number(seconds); let current = (await this.db.all('SELECT * FROM automation_queue_items WHERE id=? AND run_id=?', [run.current_item_id, run.id]))[0]; while (current && remaining >= Math.max(0.001, current.duration - run.simulated_elapsed)) { remaining -= Math.max(0, current.duration - run.simulated_elapsed); await this.completeItem(run, current, current.status === 'skipped' ? 'skipped' : 'simulated'); current = (await this.db.all("SELECT * FROM automation_queue_items WHERE run_id=? AND position>? AND status IN ('ready','pending') ORDER BY position LIMIT 1", [run.id, current.position]))[0]; run.current_item_id = current?.id || null; run.simulated_elapsed = 0; if (!current) break; }
    if (!current) { await this.db.run("UPDATE automation_runs SET status='stopped',current_item_id=NULL,simulated_elapsed=0,ended_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?", [run.id]); this.clearTimer(); }
    else { await this.db.run("UPDATE automation_queue_items SET status='playing',updated_at=CURRENT_TIMESTAMP WHERE id=?", [current.id]); await this.db.run('UPDATE automation_runs SET current_item_id=?,simulated_elapsed=?,updated_at=CURRENT_TIMESTAMP WHERE id=?', [current.id, run.simulated_elapsed + remaining, run.id]); }
    return this.getStatus(); }
  async completeItem(run, item, result) { await this.db.run("UPDATE automation_queue_items SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?", [result === 'simulated' ? 'done' : result, item.id]); await this.db.run('INSERT INTO automation_history (run_id,queue_item_id,planned_at,simulated_at,result,warnings_json) VALUES (?,?,?,?,?,?)', [run.id,item.id,item.scheduled_at,new Date().toISOString(),result,item.warnings_json]); }
  async pause() { const run=await this.latestRun(); if(!run||run.status!=='simulating') throw new AutomationError('La simulación no está activa.',409); await this.db.run("UPDATE automation_runs SET status='paused',updated_at=CURRENT_TIMESTAMP WHERE id=?",[run.id]); this.clearTimer(); return this.getStatus(); }
  async resume(input={}) { const run=await this.latestRun(); if(!run||run.status!=='paused') throw new AutomationError('La simulación no está pausada.',409); return this.start({speed:input.speed||run.simulated_speed}); }
  async stop(requireRun=true) { const run=await this.latestRun(); if(!run){if(requireRun)throw new AutomationError('No hay una ejecución activa.',409);return this.getStatus();} await this.db.run("UPDATE automation_runs SET status='stopped',ended_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=?",[run.id]); this.clearTimer(); return this.getStatus(); }
  async skip() { const run=await this.latestRun(); if(!run||!['simulating','paused'].includes(run.status))throw new AutomationError('Solo puedes saltar durante una simulación.',409); const item=(await this.db.all('SELECT * FROM automation_queue_items WHERE id=?',[run.current_item_id]))[0]; if(!item)throw new AutomationError('No hay un elemento actual.',409); await this.completeItem(run,item,'skipped'); const next=(await this.db.all("SELECT * FROM automation_queue_items WHERE run_id=? AND position>? AND status IN ('ready','pending') ORDER BY position LIMIT 1",[run.id,item.position]))[0]; await this.db.run('UPDATE automation_runs SET current_item_id=?,simulated_elapsed=0,updated_at=CURRENT_TIMESTAMP WHERE id=?',[next?.id||null,run.id]); return this.getStatus(); }
  async clear() { const run=await this.latestRun(); if(!run)return {cleared:true}; this.clearTimer(); await this.db.run('DELETE FROM automation_runs WHERE id=?',[run.id]); return {cleared:true}; }
  async setQueueStatus(id,status) { if(!['ready','pending','skipped','error'].includes(status))throw new AutomationError('Estado de cola no válido.'); const row=(await this.db.all('SELECT * FROM automation_queue_items WHERE id=?',[id]))[0]; if(!row)throw new AutomationError('Elemento de cola no encontrado.',404); await this.db.run('UPDATE automation_queue_items SET status=?,updated_at=CURRENT_TIMESTAMP WHERE id=?',[status,id]); return itemDto((await this.db.all('SELECT * FROM automation_queue_items WHERE id=?',[id]))[0]); }
  clearTimer() { if(this.timer)clearInterval(this.timer); this.timer=null; }
}
