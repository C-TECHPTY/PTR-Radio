import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
process.env.DATABASE_PATH = path.join(
  tmpdir(),
  `ptr-on-air-${randomUUID()}.db`,
);
for (const key of [
  "ON_AIR_LIVE_NAME",
  "ON_AIR_LIVE_HOST",
  "ON_AIR_LIVE_PORT",
  "ON_AIR_LIVE_MOUNT",
  "ON_AIR_LIVE_USERNAME",
  "ON_AIR_LIVE_PASSWORD_ENV",
  "ON_AIR_LIVE_PASSWORD",
  "ON_AIR_LIVE_CODEC",
  "ON_AIR_LIVE_BITRATE",
  "ON_AIR_LIVE_SAMPLE_RATE",
  "ON_AIR_LIVE_CHANNELS",
  "ON_AIR_LIVE_OUTPUT_ENABLED",
])
  process.env[key] = "";
const db = await import("../src/database.js");
const {
  OnAirEngineService,
  OnAirError,
  FfmpegAudioAdapter,
  redactUrlCredentials,
} = await import("../src/services/OnAirEngineService.js");
await db.initializeDatabase();
const queue = (await db.all("SELECT id FROM live_assist_queues LIMIT 1"))[0];
for (const [position, title] of ["Uno", "Dos", "Tres"].entries())
  await db.run(
    "INSERT INTO live_assist_queue_items (queue_id,position,media_id,item_type,title,artist,duration,status) VALUES (?,?,?,?,?,?,?,'pending')",
    [queue.id, position, `media-${position}`, "Música", title, "PTR", 60],
  );
const calls = [];
let latestMixer;
const adapter = {
  detect: async () => ({
    available: true,
    name: "ffmpeg",
    version: "ffmpeg test",
  }),
  render: async (options) => {
    calls.push(options);
    return {
      path: options.output,
      duration: 178,
      size: 2048,
      bitrate: 128000,
      codec: "mp3",
      sampleRate: 44100,
      channels: 2,
    };
  },
  startLiveMixer: (options) => {
    calls.push({ mixer: options });
    latestMixer = {
      done: new Promise(() => {}),
      trackControl: null,
      cartControl: null,
    };
    return latestMixer;
  },
  playMixerTrack: () => {
    let resolve;
    const done = new Promise((value) => (resolve = value));
    return { done, stop: () => resolve({ stopped: true }) };
  },
  playMixerCart: () => {
    let resolve;
    const done = new Promise((value) => (resolve = value));
    return { done, stop: () => resolve({ stopped: true }) };
  },
  stopLiveMixer: (mixer) => {
    mixer.trackControl?.stop();
    mixer.cartControl?.stop();
    calls.push("stop-mixer");
  },
  stop: () => calls.push("stop"),
};
const mediaProvider = async () =>
  new Response(new Uint8Array([0x49, 0x44, 0x33, 1, 2, 3]), {
    status: 200,
    headers: { "content-type": "audio/mpeg" },
  });

test("detecta adaptador y mantiene protegida la salida principal", async () => {
  const service = new OnAirEngineService(db, {
    mediaProvider,
    ffmpegAdapter: adapter,
  });
  const status = await service.initialize();
  assert.equal(status.adapter, "ffmpeg");
  assert.equal(status.principalConnected, false);
  assert.equal(status.autoDjControlled, false);
  assert.equal(status.mode, "test-only");
  service.shutdown();
});
test("exige salida test_only habilitada y doble confirmación", async () => {
  const service = new OnAirEngineService(db, {
    mediaProvider,
    ffmpegAdapter: adapter,
  });
  await service.initialize();
  await assert.rejects(
    service.startFileTest({ confirmOutput: true, confirmStart: true }),
    /Habilita/,
  );
  const output = (await service.outputs())[0];
  await service.updateOutput(output.id, { enabled: true, testOnly: true });
  await assert.rejects(
    service.startFileTest({ confirmOutput: true }),
    /dos confirmaciones/,
  );
  await assert.rejects(
    service.updateOutput(output.id, { testOnly: false }),
    (error) => error instanceof OnAirError && error.status === 403,
  );
  service.shutdown();
});
test("procesa tres pistas y persiste métricas sin navegador", async () => {
  const service = new OnAirEngineService(db, {
    mediaProvider,
    ffmpegAdapter: adapter,
  });
  await service.initialize();
  const output = (await service.outputs())[0];
  await service.updateOutput(output.id, { enabled: true, testOnly: true });
  await service.updateConfig({
    fadeInSeconds: 1,
    fadeOutSeconds: 2,
    crossfadeSeconds: 3,
    masterGainDb: -1,
  });
  const result = await service.startFileTest({
    sourceType: "live-assist",
    confirmOutput: true,
    confirmStart: true,
  });
  assert.equal(result.status, "completed");
  assert.equal(result.file.codec, "mp3");
  assert.equal(result.file.duration, 178);
  assert.equal(result.metrics.bytesProcessed, 2048);
  assert.equal(calls.at(-1).inputs.length, 3);
  assert.equal(calls.at(-1).crossfade, 3);
  assert.equal(
    (await service.events()).some((event) => event.type === "file_complete"),
    true,
  );
  service.shutdown();
});
test("impide doble salida y ejecuta stop de emergencia", async () => {
  let release;
  const slowAdapter = {
    ...adapter,
    render: (options) =>
      new Promise((resolve) => {
        calls.push(options);
        release = () =>
          resolve({
            path: options.output,
            duration: 10,
            size: 10,
            codec: "mp3",
            sampleRate: 44100,
            channels: 2,
          });
      }),
  };
  const service = new OnAirEngineService(db, {
    mediaProvider,
    ffmpegAdapter: slowAdapter,
  });
  await service.initialize();
  const output = (await service.outputs())[0];
  await service.updateOutput(output.id, { enabled: true, testOnly: true });
  const first = service.startFileTest({
    confirmOutput: true,
    confirmStart: true,
  });
  while (!release) await new Promise((resolve) => setTimeout(resolve, 5));
  await assert.rejects(
    service.startFileTest({ confirmOutput: true, confirmStart: true }),
    /salida de prueba activa/,
  );
  release();
  await first;
  await service.stop("emergency_stop");
  assert.equal((await service.events())[0].type, "emergency_stop");
  service.shutdown();
});
test("expone y utiliza salida remota configurada por base de datos", async () => {
  await db.run(
    `INSERT INTO on_air_outputs (name,output_type,host,port,mount,username,password_env_key,codec,bitrate,sample_rate,channels,enabled,test_only) VALUES ('Panda FM Principal','icecast','radio.example.com',8015,'/','ptr_test','PTR_LIVE_PASSWORD','mp3',128,44100,2,1,0)`,
  );
  process.env.PTR_LIVE_PASSWORD = "secret";
  const service = new OnAirEngineService(db, {
    mediaProvider,
    ffmpegAdapter: adapter,
  });
  await service.initialize();
  const outputs = await service.outputs();
  assert.equal(
    outputs.some((output) => !output.testOnly && output.hasPassword),
    true,
  );
  assert.equal((await service.config()).liveLocked, false);
  const status = await service.startLiveBroadcast({
    confirmOutput: true,
    confirmStart: true,
  });
  assert.equal(status.status, "streaming_live");
  assert.equal(status.principalConnected, true);
  assert.equal(
    calls.at(-1).mixer.targetUrl,
    "http://ptr_test:secret@radio.example.com:8015/",
  );
  while (!latestMixer.trackControl)
    await new Promise((resolve) => setTimeout(resolve, 5));
  await service.skipLiveTrack();
  while ((await service.status()).current !== "Dos")
    await new Promise((resolve) => setTimeout(resolve, 5));
  const cart = (await db.all("SELECT id FROM cartwall_buttons ORDER BY id LIMIT 1"))[0];
  await db.run(
    "UPDATE cartwall_buttons SET active=1,media_id='cart-media',duration=2 WHERE id=?",
    [cart.id],
  );
  const cartStatus = await service.playLiveCart(cart.id);
  assert.equal(cartStatus.activeCart.id, cart.id);
  await service.stopLiveCart();
  await service.stop("operator_stop");
  service.shutdown();
});
test("redacta credenciales de Icecast en errores de FFmpeg", () => {
  const message = redactUrlCredentials(
    "Error writing trailer of icecast://source:super-secret@radio.example.com:8000/test.mp3",
  );
  assert.equal(message.includes("super-secret"), false);
  assert.match(message, /source:\[REDACTED\]@radio\.example\.com/);
});
test("limita la salida mezclada a velocidad de tiempo real", () => {
  const ffmpeg = new FfmpegAudioAdapter();
  const args = ffmpeg.buildRenderArgs({
    inputs: [
      { path: "one.mp3", duration: 10 },
      { path: "two.mp3", duration: 10 },
    ],
    realtime: true,
  });
  assert.match(args[args.indexOf("-filter_complex") + 1], /arealtime=speed=1/);
  assert.equal(args.includes("-re"), false);
});
