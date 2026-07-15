import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, Album, BarChart3, CalendarDays, ChevronDown, Clock3, Disc3, Gauge, Library, ListMusic, LogOut, Mic2, Music2, Play, Radio, Search, Settings, SlidersHorizontal, Sparkles, Volume2, Waves, Zap } from 'lucide-react';
import './index.css';
import MusicLibrary from './components/MusicLibrary.jsx';
import Schedule from './components/Schedule.jsx';
import MusicalClocks from './components/MusicalClocks.jsx';
import CartwallModule from './components/Cartwall.jsx';
import LiveRadioPlayer from './components/LiveRadioPlayer.jsx';
import Automation from './components/Automation.jsx';

const API = import.meta.env.VITE_API_URL || '/api';
const nav = [
  ['Dashboard', BarChart3], ['Biblioteca Musical', Library], ['Programación', CalendarDays],
  ['Relojes Musicales', Clock3], ['Cartuchera', Zap], ['Automatización', Sparkles], ['AzuraCast', Radio], ['Configuración', Settings],
];
const colors = ['cyan', 'violet', 'amber', 'rose', 'emerald'];
const colorClasses = { cyan: 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300', violet: 'border-violet-400/30 bg-violet-400/10 text-violet-300', amber: 'border-amber-400/30 bg-amber-400/10 text-amber-300', rose: 'border-rose-400/30 bg-rose-400/10 text-rose-300', emerald: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' };

function Login({ onLogin }) {
  const [error, setError] = useState('');
  const submit = (e) => { e.preventDefault(); const data = new FormData(e.currentTarget); if (data.get('user') === 'admin' && data.get('password') === 'ptrradio') onLogin(); else setError('Usuario o contraseña incorrectos.'); };
  return <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-6">
    <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(34,211,238,.10),transparent_30%),radial-gradient(circle_at_20%_80%,rgba(139,92,246,.09),transparent_28%)]" />
    <div className="panel relative w-full max-w-md p-8 shadow-glow">
      <div className="mb-8 flex items-center gap-3"><Logo /><div><div className="text-xl font-extrabold tracking-tight">PTR RADIO</div><div className="label text-cyan-400">Automation System</div></div></div>
      <h1 className="text-2xl font-bold">Bienvenido</h1><p className="mt-2 text-sm text-slate-400">Accede a tu centro de operación radial.</p>
      <form onSubmit={submit} className="mt-8 space-y-5"><Field label="Usuario" name="user" placeholder="admin" /><Field label="Contraseña" name="password" type="password" placeholder="••••••••" />
        {error && <p className="text-sm text-rose-400">{error}</p>}<button className="w-full rounded-xl bg-cyan-400 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-300">Iniciar sesión</button>
      </form><p className="mt-6 text-center text-xs text-slate-600">PTR Radio Automation v0.1.0</p>
    </div>
  </main>;
}
function Field({ label, ...props }) { return <label className="block"><span className="label">{label}</span><input required {...props} className="mt-2 w-full rounded-xl border border-line bg-slate-950/60 px-4 py-3 text-sm placeholder:text-slate-700 focus:border-cyan-400/60" /></label>; }
function Logo() { return <div className="grid h-11 w-11 place-items-center rounded-xl bg-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20"><Waves size={25} strokeWidth={2.6} /></div>; }

function App() {
  const [logged, setLogged] = useState(() => sessionStorage.getItem('ptr-auth') === '1');
  const [active, setActive] = useState('Dashboard');
  const login = () => { sessionStorage.setItem('ptr-auth', '1'); setLogged(true); };
  const logout = () => { sessionStorage.removeItem('ptr-auth'); setLogged(false); };
  if (!logged) return <Login onLogin={login} />;
  return <><div className="flex min-h-screen"><Sidebar active={active} setActive={setActive} logout={logout} /><div className="min-w-0 flex-1 pb-24 lg:pl-64"><Header title={active} />{active === 'Dashboard' ? <Dashboard openCartwall={() => setActive('Cartuchera')} /> : active === 'Biblioteca Musical' ? <MusicLibrary /> : active === 'Programación' ? <Schedule /> : active === 'Relojes Musicales' ? <MusicalClocks /> : active === 'Cartuchera' ? <CartwallModule /> : active === 'Automatización' ? <Automation /> : <ModulePage title={active} />}</div></div><LiveRadioPlayer /></>;
}

function Sidebar({ active, setActive, logout }) { return <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-line bg-[#090e18] lg:flex">
  <div className="flex h-20 items-center gap-3 border-b border-line px-6"><Logo /><div><div className="font-extrabold">PTR RADIO</div><div className="text-[9px] font-bold tracking-[.2em] text-cyan-400">AUTOMATION</div></div></div>
  <nav className="flex-1 space-y-1 px-3 py-6">{nav.map(([label, Icon]) => <button key={label} onClick={() => setActive(label)} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${active === label ? 'bg-cyan-400/10 text-cyan-300' : 'text-slate-400 hover:bg-white/[.04] hover:text-slate-100'}`}><Icon size={18} /><span>{label}</span>{active === label && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-400" />}</button>)}</nav>
  <div className="border-t border-line p-4"><button onClick={logout} className="flex w-full items-center gap-3 rounded-xl p-3 text-sm text-slate-500 hover:bg-white/[.04] hover:text-rose-300"><LogOut size={18} /> Cerrar sesión</button></div>
  </aside>; }
function Header({ title }) { return <header className="flex h-20 items-center justify-between border-b border-line bg-ink/90 px-5 backdrop-blur md:px-8"><div><span className="label">Centro de operación</span><h1 className="text-xl font-bold">{title}</h1></div><div className="flex items-center gap-3"><button className="hidden rounded-xl border border-line p-2.5 text-slate-400 md:block"><Search size={18} /></button><div className="hidden text-right sm:block"><div className="text-sm font-semibold">Operador Principal</div><div className="text-xs text-emerald-400">● En línea</div></div><div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 font-bold">OP</div></div></header>; }

function Dashboard({ openCartwall }) {
  const [data, setData] = useState(null); const [elapsedTick, setElapsedTick] = useState(0);
  useEffect(() => {
    let active = true;
    const fallbackCartwall = Array.from({length:20}, (_,i)=>({id:i+1,label:`CART ${String(i+1).padStart(2,'0')}`,color:colors[i%5]}));
    const load = async () => { try { const response = await fetch(`${API}/dashboard`); if (!response.ok) throw new Error(); const value = await response.json(); if (active) { setData(value); setElapsedTick(0); } } catch { if (active) setData(previous => ({ azuracast: { connected: false, online: false, autoDj: false }, listeners: 0, nowPlaying: null, next: null, cartwall: previous?.cartwall || fallbackCartwall })); } };
    load(); const refresh = setInterval(load, 15000); const clock = setInterval(() => setElapsedTick(value => value + 1), 1000);
    return () => { active = false; clearInterval(refresh); clearInterval(clock); };
  }, []);
  if (!data) return <DashboardSkeleton />;
  const song = data.nowPlaying; const elapsed = song ? Math.min(song.duration || Infinity, song.elapsed + elapsedTick) : 0;
  const progress = song?.duration ? Math.min(100, Math.round(elapsed / song.duration * 100)) : 0; const remaining = song ? Math.max(0, song.duration - elapsed) : 0; const connected = Boolean(data.azuracast?.connected);
  return <main className="space-y-6 p-5 pb-10 md:p-8">{!connected && <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-300">AzuraCast desconectado</div>}<section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Stat icon={Radio} label="Estado AzuraCast" value={connected ? (data.azuracast.online ? 'En línea' : 'Fuera del aire') : 'Desconectado'} detail={data.azuracast?.station || 'API oficial'} ok={connected && data.azuracast.online} /><Stat icon={Gauge} label="Oyentes actuales" value={data.listeners ?? 0} detail="Actualización cada 15 s" /><Stat icon={Disc3} label="Estado AutoDJ" value={data.azuracast?.autoDj ? 'Activo' : 'Inactivo'} detail={data.azuracast?.autoDj ? 'Automatización al aire' : 'Manual o desconectado'} ok={data.azuracast?.autoDj} /><Stat icon={Activity} label="Señal" value={connected && data.azuracast.online ? 'Estable' : 'Sin señal'} detail="Monitoreo continuo" ok={connected && data.azuracast.online} /></section>
    <section className="grid gap-6 xl:grid-cols-[1.65fr_1fr]"><NowPlaying song={song} progress={progress} elapsed={elapsed} remaining={remaining} /><div className="space-y-6"><Next song={data.next} /><Mode autoDj={data.azuracast?.autoDj} /></div></section>
    <Cartwall items={data.cartwall} openCartwall={openCartwall} /></main>;
}
function DashboardSkeleton() { return <main className="animate-pulse space-y-6 p-5 md:p-8"><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[1,2,3,4].map(i=><div key={i} className="panel h-28 bg-slate-800/40" />)}</div><div className="grid gap-6 xl:grid-cols-[1.65fr_1fr]"><div className="panel h-80 bg-slate-800/40"/><div className="space-y-6"><div className="panel h-36 bg-slate-800/40"/><div className="panel h-36 bg-slate-800/40"/></div></div><div className="panel h-52 bg-slate-800/40"/></main>; }
function Stat({ icon: Icon, label, value, detail, ok }) { return <div className="panel flex items-center gap-4 p-5"><div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-800 text-cyan-300"><Icon size={21} /></div><div className="min-w-0"><div className="label">{label}</div><div className="mt-1 truncate text-xl font-bold">{value}</div><div className={`mt-1 text-xs ${ok ? 'text-emerald-400' : 'text-slate-500'}`}>{detail}</div></div></div>; }
function NowPlaying({ song, progress, elapsed, remaining }) { return <div className="panel overflow-hidden"><div className="flex items-center justify-between border-b border-line p-5"><div className="flex items-center gap-2 text-sm font-bold"><Volume2 size={17} className="text-cyan-400" /> AL AIRE AHORA</div>{song && <span className="rounded-full bg-rose-500/10 px-3 py-1 text-[10px] font-bold tracking-widest text-rose-400"><span className="mr-1 animate-pulse">●</span> EN VIVO</span>}</div><div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center"><div className="grid aspect-square w-full max-w-44 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-cyan-500/20 via-violet-500/20 to-slate-900 shadow-glow">{song?.artwork ? <img src={song.artwork} alt={`Carátula de ${song.title}`} className="h-full w-full object-cover" /> : <Music2 size={60} className="text-cyan-300/70" />}</div><div className="min-w-0 flex-1"><div className="label">Reproduciendo</div><h2 className="mt-2 truncate text-3xl font-extrabold tracking-tight">{song?.title || 'Sin reproducción'}</h2><p className="mt-1 text-lg text-slate-400">{song?.artist || 'AzuraCast desconectado'}</p>{song?.album && <p className="mt-1 truncate text-sm text-slate-500">{song.album}</p>}<div className="mt-8 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-violet-500" style={{width:`${progress}%`}} /></div><div className="mt-3 flex justify-between font-mono text-xs text-slate-500"><span>{format(elapsed)}</span><span className="text-cyan-300">-{format(remaining)}</span><span>{format(song?.duration)}</span></div></div></div></div>; }
function Next({ song }) { return <div className="panel p-5"><div className="label flex items-center gap-2"><ListMusic size={15} /> Próxima canción</div><div className="mt-4 flex items-center gap-4"><div className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-violet-500/10 text-violet-300">{song?.artwork ? <img src={song.artwork} alt="" className="h-full w-full object-cover"/> : <Album />}</div><div className="min-w-0"><div className="truncate font-bold">{song?.title || 'No disponible'}</div><div className="truncate text-sm text-slate-500">{song?.artist || 'La API no ofrece una próxima canción'}</div></div><Play className="ml-auto text-slate-600" size={18} /></div></div>; }
function Mode({ autoDj }) { return <div className="panel p-5"><div className="label mb-4 flex items-center gap-2"><SlidersHorizontal size={15} /> Estado de emisión</div><div className={`rounded-xl border p-4 ${autoDj?'border-cyan-400/40 bg-cyan-400/10 text-cyan-300':'border-line bg-slate-950/30 text-slate-500'}`}>{autoDj ? <Sparkles size={18}/> : <Mic2 size={18}/>}<div className="mt-3 text-sm font-bold">{autoDj ? 'AutoDJ activo' : 'AutoDJ inactivo'}</div></div></div>; }
function Cartwall({ items, openCartwall }) { return <section className="panel p-5"><div className="mb-4 flex items-center justify-between"><div><div className="label">Acceso instantáneo</div><h2 className="mt-1 font-bold">Cartuchera</h2></div><button onClick={openCartwall} className="rounded-lg border border-line p-2 text-slate-500"><Settings size={16}/></button></div><div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-10">{items.map((item,i)=><button onClick={openCartwall} key={item.id} className={`group min-h-20 rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:brightness-125 ${colorClasses[item.color] || colorClasses.cyan}`}><Zap size={15}/><div className="mt-3 truncate text-[11px] font-extrabold">{item.label}</div><div className="mt-1 text-[9px] opacity-50">{item.hotkey || `F${(i%10)+1}`}</div></button>)}</div></section>; }
function ModulePage({ title }) { const descriptions = { 'Biblioteca Musical':'Gestiona pistas, metadatos, categorías y búsquedas.', 'Programación':'Organiza eventos, bloques y parrillas de emisión.', 'Relojes Musicales':'Diseña rotaciones y reglas de programación.', 'Cartuchera':'Configura efectos, identificadores y audios instantáneos.', 'AzuraCast':'Conecta y supervisa tu estación mediante la API oficial.', 'Configuración':'Administra operadores, rutas y preferencias del sistema.' }; return <main className="p-5 md:p-8"><div className="panel grid min-h-[65vh] place-items-center p-8 text-center"><div><div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-cyan-400/10 text-cyan-300"><Waves size={30}/></div><h2 className="mt-6 text-2xl font-bold">{title}</h2><p className="mx-auto mt-2 max-w-md text-slate-500">{descriptions[title]} El módulo está preparado para la siguiente fase funcional.</p><span className="mt-6 inline-block rounded-full border border-line px-4 py-2 text-xs text-slate-500">Módulo base activo</span></div></div></main>; }
function format(seconds=0) { const m=Math.floor(seconds/60); const s=Math.floor(seconds%60); return `${m}:${String(s).padStart(2,'0')}`; }

createRoot(document.getElementById('root')).render(<React.StrictMode><App /></React.StrictMode>);
