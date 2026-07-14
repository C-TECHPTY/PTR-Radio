import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
dotenv.config({ path: path.join(root, '.env') });

export const config = {
  port: Number(process.env.PORT || 8091),
  databasePath: path.resolve(root, process.env.DATABASE_PATH || './database/ptr-radio.db'),
  azuracast: {
    url: (process.env.AZURACAST_URL || '').replace(/\/$/, ''),
    stationId: process.env.AZURACAST_STATION_ID || '',
    stationShortName: process.env.AZURACAST_STATION_SHORT_NAME || '',
    apiKey: process.env.AZURACAST_API_KEY || '',
    timeoutMs: 7000,
  },
};
