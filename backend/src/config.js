import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const config = {
  port: Number(process.env.PORT || 8091),
  databasePath: path.resolve(root, process.env.DATABASE_PATH || './database/ptr-radio.db'),
  azuracast: {
    baseUrl: (process.env.AZURACAST_BASE_URL || '').replace(/\/$/, ''),
    stationId: process.env.AZURACAST_STATION_ID || '',
    apiKey: process.env.AZURACAST_API_KEY || '',
  },
};
