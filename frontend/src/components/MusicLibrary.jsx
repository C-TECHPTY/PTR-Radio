import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Album, Clock3, Disc3, Filter, HardDrive, Library, ListMusic, Music2, RefreshCw, Search, X } from 'lucide-react';

const API = import.meta.env.VITE_API_URL || '/api';

export default function MusicLibrary() {
  const [tracks, setTracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [genre, setGenre] = useState('all');
  const [playlist, setPlaylist] = useState('all');

  const loadMedia = async () => {
    setLoading(true); setError('');
    try {
      const response = await fetch(`${API}/azuracast/media`, { headers: { Accept: 'application/json' } });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || 'No se pudo consultar la biblioteca musical.');
      if (!Array.isArray(body)) throw new Error('La biblioteca recibió una respuesta inválida.');
      setTracks(body);
    } catch (requestError) {
      setTracks([]); setError(requestError.message || 'AzuraCast no está disponible en este momento.');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadMedia(); }, []);

  const genres = useMemo(() => [...new Set(tracks.map(track => track.genre).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [tracks]);
  const playlists = useMemo(() => [...new Set(tracks.flatMap(track => track.playlists || []).map(item => item.name).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [tracks]);
  const filteredTracks = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return tracks.filter(track => {
      const matchesQuery = !term || [track.title, track.artist, track.album, track.genre, track.path, ...(track.playlists || []).map(item => item.name)].some(value => String(value || '').toLocaleLowerCase().includes(term));
      const matchesGenre = genre === 'all' || track.genre === genre;
      const matchesPlaylist = playlist === 'all' || (track.playlists || []).some(item => item.name === playlist);
      return matchesQuery && matchesGenre && matchesPlaylist;
    });
  }, [tracks, query, genre, playlist]);
  const filtersActive = Boolean(query || genre !== 'all' || playlist !== 'all');
  const clearFilters = () => { setQuery(''); setGenre('all'); setPlaylist('all'); };

  return <main className="space-y-6 p-5 pb-10 md:p-8">
    <section className="flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
      <div><div className="label flex items-center gap-2"><Library size={14} /> Colección de AzuraCast</div><h2 className="mt-2 text-2xl font-extrabold tracking-tight">Biblioteca Musical</h2><p className="mt-1 text-sm text-slate-500">Explora el catálogo disponible para automatización y playlists.</p></div>
      {!loading && !error && <div className="flex gap-3"><Summary value={tracks.length} label="Pistas" /><Summary value={formatDuration(tracks.reduce((total, track) => total + (track.duration || 0), 0))} label="Duración" /><Summary value={formatBytes(tracks.reduce((total, track) => total + (track.size || 0), 0))} label="Tamaño" /></div>}
    </section>

    <section className="panel p-4"><div className="grid gap-3 lg:grid-cols-[1fr_220px_220px_auto]">
      <label className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={17}/><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar título, artista, álbum..." className="h-11 w-full rounded-xl border border-line bg-slate-950/50 pl-10 pr-4 text-sm placeholder:text-slate-600 focus:border-cyan-400/50" /></label>
      <Select icon={Disc3} value={genre} onChange={setGenre} label="Todos los géneros" options={genres}/>
      <Select icon={ListMusic} value={playlist} onChange={setPlaylist} label="Todas las playlists" options={playlists}/>
      <button onClick={clearFilters} disabled={!filtersActive} className="flex h-11 items-center justify-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold text-slate-400 transition hover:border-slate-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"><X size={16}/> Limpiar</button>
    </div></section>

    {loading ? <LibrarySkeleton /> : error ? <ErrorState message={error} retry={loadMedia} /> : filteredTracks.length ? <TrackList tracks={filteredTracks} total={tracks.length} /> : <EmptyState filtered={filtersActive} clearFilters={clearFilters} />}
  </main>;
}

function Select({ icon: Icon, value, onChange, label, options }) { return <label className="relative"><Icon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16}/><select value={value} onChange={event => onChange(event.target.value)} className="h-11 w-full appearance-none rounded-xl border border-line bg-slate-950/50 pl-10 pr-8 text-sm text-slate-300 focus:border-cyan-400/50"><option value="all">{label}</option>{options.map(option => <option key={option} value={option}>{option}</option>)}</select><Filter className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-600" size={14}/></label>; }
function Summary({ value, label }) { return <div className="min-w-24 rounded-xl border border-line bg-panel px-4 py-3"><div className="text-sm font-bold text-slate-200">{value}</div><div className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">{label}</div></div>; }

function TrackList({ tracks, total }) { return <section className="panel overflow-hidden"><div className="flex items-center justify-between border-b border-line px-5 py-4"><span className="text-sm font-semibold">{tracks.length} de {total} pistas</span><span className="label">Solo lectura</span></div><div className="overflow-x-auto"><div className="min-w-[880px]"><div className="grid grid-cols-[minmax(330px,1.7fr)_minmax(150px,.8fr)_120px_100px_minmax(160px,1fr)] gap-4 border-b border-line bg-slate-950/30 px-5 py-3 text-[10px] font-bold uppercase tracking-[.14em] text-slate-600"><span>Pista</span><span>Género</span><span>Duración</span><span>Tamaño</span><span>Playlists</span></div>{tracks.map((track, index) => <TrackRow key={track.uniqueId || track.id || track.path || index} track={track}/>)}</div></div></section>; }
function TrackRow({ track }) { return <article className="grid grid-cols-[minmax(330px,1.7fr)_minmax(150px,.8fr)_120px_100px_minmax(160px,1fr)] items-center gap-4 border-b border-line/70 px-5 py-3.5 transition last:border-0 hover:bg-white/[.025]"><div className="flex min-w-0 items-center gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-gradient-to-br from-cyan-500/15 to-violet-500/15 text-cyan-300">{track.artwork ? <img src={track.artwork} alt="" loading="lazy" className="h-full w-full object-cover"/> : <Music2 size={20}/>}</div><div className="min-w-0"><div className="truncate text-sm font-bold text-slate-100">{track.title}</div><div className="mt-0.5 truncate text-xs text-slate-400">{track.artist}</div><div className="mt-0.5 truncate text-[11px] text-slate-600">{track.album || 'Sin álbum'}</div></div></div><div><span className="inline-flex max-w-full truncate rounded-full border border-violet-400/20 bg-violet-400/10 px-2.5 py-1 text-xs text-violet-300">{track.genre || 'Sin género'}</span></div><div className="flex items-center gap-2 font-mono text-xs text-slate-400"><Clock3 size={14} className="text-slate-600"/>{formatDuration(track.duration)}</div><div className="flex items-center gap-2 text-xs text-slate-400"><HardDrive size={14} className="text-slate-600"/>{formatBytes(track.size)}</div><div className="flex flex-wrap gap-1.5">{track.playlists?.length ? track.playlists.map((item, index) => <span key={item.id || `${item.name}-${index}`} className="max-w-36 truncate rounded-md bg-cyan-400/10 px-2 py-1 text-[10px] font-semibold text-cyan-300">{item.name}</span>) : <span className="text-xs text-slate-600">Sin playlist</span>}</div></article>; }

function LibrarySkeleton() { return <section className="panel animate-pulse overflow-hidden"><div className="h-14 border-b border-line bg-slate-800/30"/>{Array.from({length:7}, (_,index)=><div key={index} className="flex items-center gap-4 border-b border-line/60 px-5 py-3"><div className="h-12 w-12 rounded-lg bg-slate-800"/><div className="flex-1"><div className="h-3 w-1/3 rounded bg-slate-800"/><div className="mt-2 h-2.5 w-1/5 rounded bg-slate-800/70"/></div><div className="h-6 w-24 rounded-full bg-slate-800"/><div className="h-3 w-16 rounded bg-slate-800"/></div>)}</section>; }
function ErrorState({ message, retry }) { return <section className="panel grid min-h-80 place-items-center p-8 text-center"><div><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-rose-500/10 text-rose-300"><AlertCircle size={27}/></div><h3 className="mt-5 text-lg font-bold">No pudimos cargar la biblioteca</h3><p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{message}</p><button onClick={retry} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 hover:bg-cyan-300"><RefreshCw size={16}/> Intentar de nuevo</button></div></section>; }
function EmptyState({ filtered, clearFilters }) { return <section className="panel grid min-h-80 place-items-center p-8 text-center"><div><div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300">{filtered ? <Search size={27}/> : <Album size={27}/>}</div><h3 className="mt-5 text-lg font-bold">{filtered ? 'No encontramos coincidencias' : 'La biblioteca está vacía'}</h3><p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{filtered ? 'Prueba con otros términos o elimina los filtros activos.' : 'Cuando AzuraCast tenga archivos musicales, aparecerán aquí automáticamente.'}</p>{filtered && <button onClick={clearFilters} className="mt-5 text-sm font-bold text-cyan-300 hover:text-cyan-200">Limpiar filtros</button>}</div></section>; }
function formatDuration(seconds = 0) { const value = Math.max(0, Number(seconds) || 0); const hours = Math.floor(value / 3600); const minutes = Math.floor((value % 3600) / 60); const rest = Math.floor(value % 60); return hours ? `${hours}:${String(minutes).padStart(2,'0')}:${String(rest).padStart(2,'0')}` : `${minutes}:${String(rest).padStart(2,'0')}`; }
function formatBytes(bytes = 0) { const value = Math.max(0, Number(bytes) || 0); if (!value) return '0 B'; const units = ['B','KB','MB','GB','TB']; const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1); return `${(value / (1024 ** index)).toFixed(index > 1 ? 1 : 0)} ${units[index]}`; }
