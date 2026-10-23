import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';

const app = express();
const dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(dirname, '..', 'public')));

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

export default app;
