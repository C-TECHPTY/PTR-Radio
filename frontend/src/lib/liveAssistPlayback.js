export class LiveAssistPlayback {
  constructor({audio,onState=()=>{},onEnded=()=>{},onError=()=>{},storage=globalThis.localStorage,setTimer=setInterval,clearTimer=clearInterval}){this.audio=audio;this.onState=onState;this.onEnded=onEnded;this.onError=onError;this.setTimer=setTimer;this.clearTimer=clearTimer;this.item=null;this.startedAt=null;this.volume=Math.min(1,Math.max(0,Number(storage?.getItem('ptr-live-assist-volume')??0.8)));this.storage=storage;audio.volume=this.volume;audio.preload='metadata';this.events={play:()=>{this.startedAt=new Date().toISOString();this.emit('playing')},pause:()=>this.emit('paused'),timeupdate:()=>this.emit(this.audio.paused?'paused':'playing'),ended:()=>{this.emit('ended');this.onEnded({item:this.item,actualDuration:this.audio.currentTime,startedAt:this.startedAt})},error:()=>{this.emit('error');this.onError({item:this.item,error:this.audio.error})}};for(const [name,fn] of Object.entries(this.events))audio.addEventListener(name,fn);this.emit('stopped');}
  snapshot(status){return {status,item:this.item,currentTime:Number(this.audio.currentTime||0),duration:Number(this.audio.duration||this.item?.duration||0),volume:this.volume,paused:this.audio.paused,error:this.audio.error||null};}
  emit(status){this.onState(this.snapshot(status));}
  source(item){const base=globalThis.location?.href||'http://localhost/';if(item.metadata?.audioUrl)return new URL(item.metadata.audioUrl,base).toString();if(item.mediaId)return new URL(`/api/cartwall/media/${encodeURIComponent(item.mediaId)}/audio`,base).toString();throw new Error('El elemento no tiene audio reproducible.');}
  load(item){this.item=item;this.startedAt=null;const src=this.source(item);if(this.audio.src!==src)this.audio.src=src;this.audio.load?.();this.emit('ready');return src;}
  async play(item=this.item){if(item&&item.id!==this.item?.id)this.load(item);if(!this.item)throw new Error('Selecciona un elemento de la cola.');await this.audio.play();}
  pause(){this.audio.pause();}
  stop(){this.audio.pause();this.audio.currentTime=0;this.emit('stopped');}
  restart(){this.audio.currentTime=0;return this.play();}
  setVolume(value){this.volume=Math.min(1,Math.max(0,Number(value)));this.audio.volume=this.volume;this.storage?.setItem('ptr-live-assist-volume',String(this.volume));this.emit(this.audio.paused?'paused':'playing');}
  fade(seconds=2){const steps=20,start=this.audio.volume;let step=0;return new Promise(resolve=>{const timer=this.setTimer(()=>{step+=1;this.audio.volume=Math.max(0,start*(1-step/steps));if(step>=steps){this.clearTimer(timer);this.stop();this.audio.volume=this.volume;resolve();}},Math.max(20,seconds*1000/steps));});}
  dispose(){this.stop();for(const [name,fn] of Object.entries(this.events))this.audio.removeEventListener(name,fn);}
}
