import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { store } from './db/store.js';
import { apiRouter } from './routes/api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
function resolveProjectRoot(startDir: string): string {
  let dir = startDir;
  for (let i = 0; i < 6; i++) {
    if (fs.existsSync(path.join(dir, 'data', 'seed-notebooklm.json'))) return dir;
    dir = path.dirname(dir);
  }
  return path.resolve(startDir, '../..');
}
const ROOT = resolveProjectRoot(__dirname);
dotenv.config({ path: path.join(ROOT, 'server', '.env') });

const PORT = Number(process.env.PORT || 4000);
const AUDIO_DIR = path.join(ROOT, 'client', 'public', 'audio');
const CLIENT_DIST = path.join(ROOT, 'client', 'dist');

async function bootstrap() {
  await store.init();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '5mb' }));

  app.use('/api', apiRouter);

  if (fs.existsSync(AUDIO_DIR)) {
    app.use('/audio', express.static(AUDIO_DIR));
  }

  if (fs.existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path.startsWith('/audio')) return next();
      res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`🚀 EchoSpeak API Server listening on http://localhost:${PORT}`);
  });
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
