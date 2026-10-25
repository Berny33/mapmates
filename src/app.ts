import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import { sessionMiddleware } from './config/session.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import authRoutes from './routes/auth.routes.js';

const app = express();
const dirname = path.dirname(fileURLToPath(import.meta.url));

app.use(helmet());
app.use(express.static(path.join(dirname, '..', 'public')));
app.use(express.json({ limit: '10kb' }));
app.use(sessionMiddleware);

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
