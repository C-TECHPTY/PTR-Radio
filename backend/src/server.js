import { app } from './app.js';
import { config } from './config.js';
import { initializeDatabase } from './database.js';

await initializeDatabase();
app.listen(config.port, '0.0.0.0', () => console.log(`PTR Radio Automation disponible en http://localhost:${config.port}`));
