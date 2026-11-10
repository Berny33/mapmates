import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import { sessionMiddleware } from './config/session.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import authRoutes from './routes/auth.routes.js';
import tripRoutes from './routes/trip.routes.js';

const app = express();
const dirname = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.join(dirname, '..', '..', 'frontend');

app.use(helmet());
app.use(express.static(frontendDir));
app.use(express.json({ limit: '10kb' }));
app.use(sessionMiddleware);

const pages: Record<string, string> = {
  '/login': 'login.html',
  '/register': 'register.html',
  '/trips': 'trips.html',
  '/create-trip': 'create-trip.html',
};

app.get(Object.keys(pages), (req, res, next) => {
  const page = pages[req.path];

  if (!page) {
    next();
    return;
  }

  res.sendFile(path.join(frontendDir, page));
});

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/trips', tripRoutes);
app.use(notFound);
app.use(errorHandler);

export default app;
