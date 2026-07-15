const clamp = (value) => Math.min(1, Math.max(0, Number(value) || 0));

export class LiveRadioController {
  constructor({ audio, storage = globalThis.localStorage, onState = () => {}, setTimer = setTimeout, clearTimer = clearTimeout }) {
    this.audio = audio; this.storage = storage; this.onState = onState; this.setTimer = setTimer; this.clearTimer = clearTimer;
    this.intent = false; this.retry = 0; this.timer = null; this.source = ''; this.status = 'Sin señal';
    this.volume = clamp(storage?.getItem('ptr-live-volume') ?? 0.7); this.muted = storage?.getItem('ptr-live-muted') === '1';
    audio.volume = this.volume; audio.muted = this.muted; audio.preload = 'none';
    this.listeners = {
      loadstart: () => this.emit('Conectando'), waiting: () => this.emit(this.retry ? 'Reintentando' : 'Conectando'), stalled: () => this.schedule(),
      playing: () => { this.retry = 0; this.emit('En vivo'); }, pause: () => { if (!this.intent) this.emit('Pausado'); },
      error: () => this.schedule(), ended: () => this.schedule(),
    };
    for (const [event, listener] of Object.entries(this.listeners)) audio.addEventListener(event, listener);
    this.emit('Sin señal');
  }
  snapshot() { return { status: this.status, playing: this.intent && !this.audio.paused, volume: this.volume, muted: this.muted, retry: this.retry, source: this.source, error: this.audio.error || null }; }
  emit(status = this.status) { this.status = status; this.onState(this.snapshot()); }
  setSource(url) { this.source = new URL(url, globalThis.location?.href).toString(); if (this.audio.src !== this.source) this.audio.src = this.source; this.emit(); }
  async play() { if (!this.source) throw new Error('La URL de la señal todavía no está disponible.'); this.intent = true; this.clearRetry(); this.emit('Conectando'); try { await this.audio.play(); } catch (error) { this.intent = false; this.emit('Error'); throw error; } }
  pause() { this.intent = false; this.clearRetry(); this.audio.pause(); this.emit('Pausado'); }
  setVolume(value) { this.volume = clamp(value); this.audio.volume = this.volume; this.storage?.setItem('ptr-live-volume', String(this.volume)); this.emit(); }
  toggleMute() { this.muted = !this.muted; this.audio.muted = this.muted; this.storage?.setItem('ptr-live-muted', this.muted ? '1' : '0'); this.emit(); }
  schedule() { if (!this.intent) return this.emit('Sin señal'); this.clearRetry(); this.retry += 1; this.emit('Reintentando'); const delay = Math.min(30000, 1000 * (2 ** Math.min(this.retry, 5))); this.timer = this.setTimer(() => { if (!this.intent) return; this.audio.load?.(); this.audio.play().catch(() => this.schedule()); }, delay); }
  clearRetry() { if (this.timer !== null) this.clearTimer(this.timer); this.timer = null; }
  dispose() { this.pause(); for (const [event, listener] of Object.entries(this.listeners)) this.audio.removeEventListener(event, listener); }
}

export { clamp };
