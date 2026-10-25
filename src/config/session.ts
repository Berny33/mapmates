import connectPgSimple from 'connect-pg-simple';
import session from 'express-session';
import { pool } from './db.js';

declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}

const secret = process.env.SESSION_SECRET;

if (!secret) {
  throw new Error('SESSION_SECRET is not set');
}

const PgSession = connectPgSimple(session);

export const sessionMiddleware = session({
  store: new PgSession({
    pool,
    tableName: 'session',
    pruneSessionInterval: process.env.NODE_ENV === 'test' ? false : 60,
  }),
  name: 'mapmates.sid',
  secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
});
