import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import { readdir, rm, stat } from 'node:fs/promises';
import { ProgressiveMediaCache } from '../src/services/OnAirEngineService.js';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const directory=()=>path.join(tmpdir(),`ptr-cache-test-${randomUUID()}`);
const item={media_id:'large-track',title:'Pista grande',duration:120};

test('transfiere progresivamente sin timeout falso mientras llegan bytes',async t=>{const cacheDir=directory();t.after(()=>rm(cacheDir,{recursive:true,force:true}));let pulls=0;const provider=async()=>new Response(new ReadableStream({async pull(controller){await delay(25);controller.enqueue(new Uint8Array(32768));pulls+=1;if(pulls===8)controller.close()}}),{headers:{'content-type':'audio/mpeg'}});const cache=new ProgressiveMediaCache({mediaProvider:provider,cacheDir,idleTimeoutMs:80,maxDownloadMs:0});const result=await cache.get(item);assert.equal((await stat(result.path)).size,262144);assert.equal(result.cached,false);assert.equal((await readdir(cacheDir)).some(name=>name.includes('.part-')),false)});
test('detecta inactividad real y elimina el archivo parcial',async t=>{const cacheDir=directory();t.after(()=>rm(cacheDir,{recursive:true,force:true}));const provider=async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(32))}}));const cache=new ProgressiveMediaCache({mediaProvider:provider,cacheDir,idleTimeoutMs:40,maxDownloadMs:0});await assert.rejects(cache.get({...item,media_id:'idle'}),/inactiva/);assert.deepEqual(await readdir(cacheDir),[])});
test('deduplica descargas simultáneas y reutiliza caché',async t=>{const cacheDir=directory();t.after(()=>rm(cacheDir,{recursive:true,force:true}));let calls=0;const provider=async()=>{calls+=1;await delay(25);return new Response(new Uint8Array(1024))};const cache=new ProgressiveMediaCache({mediaProvider:provider,cacheDir});const [first,second]=await Promise.all([cache.get(item),cache.get(item)]);assert.equal(calls,1);assert.equal(first.path,second.path);const third=await cache.get(item);assert.equal(third.cached,true);assert.equal(calls,1)});
test('cancela transferencia y limpia temporales',async t=>{const cacheDir=directory();t.after(()=>rm(cacheDir,{recursive:true,force:true}));const provider=async(_id,_range,signal)=>new Response(new ReadableStream({async pull(controller){await delay(20);if(signal.aborted)return controller.error(signal.reason);controller.enqueue(new Uint8Array(1024))}}));const cache=new ProgressiveMediaCache({mediaProvider:provider,cacheDir,idleTimeoutMs:1000});const pending=cache.get({...item,media_id:'cancel'});await delay(50);cache.cancel();await assert.rejects(pending,/cancelada|cancelado|operador/i);assert.equal((await readdir(cacheDir)).some(name=>name.includes('.part-')),false)});
