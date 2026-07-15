import { app } from './app.js';
import { config } from './config.js';
import { initializeDatabase } from './database.js';
import { serverAudioService } from './routes/server-audio.js';
import { onAirService } from './routes/on-air.js';

await initializeDatabase();
await serverAudioService.initialize();
await onAirService.initialize();
const server=app.listen(config.port, '0.0.0.0', () => console.log(`PTR Radio Automation disponible en http://localhost:${config.port}`));
const shutdown=()=>{onAirService.shutdown();server.close(()=>process.exit(0))};
process.once('SIGINT',shutdown);
process.once('SIGTERM',shutdown);
