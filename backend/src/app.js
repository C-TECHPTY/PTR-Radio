import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import { api } from './routes/api.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const frontend = path.join(root, 'frontend', 'dist');
export const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('combined'));
app.use('/api', api);
app.use(express.static(frontend));
app.get('*splat', (req, res, next) => { if (req.path.startsWith('/api')) return next(); res.sendFile(path.join(frontend, 'index.html'), error => error && next(error)); });
app.use((error, _req, res, _next) => { console.error(error); res.status(500).json({ error: 'Error interno del servidor.' }); });
