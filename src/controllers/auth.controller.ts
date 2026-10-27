import type { Request, Response } from 'express';
import {
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
} from '../config/session.js';
import type { AuthService } from '../services/auth.service.js';
import { getAuthenticatedUserId } from '../utils/session.js';

function regenerateSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
}

function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((error) => (error ? reject(error) : resolve()));
  });
}

export function createAuthController(authService: AuthService) {
  return {
    async register(req: Request, res: Response): Promise<void> {
      const user = await authService.register(req.body);

      res.status(201).json(user);
    },

    async login(req: Request, res: Response): Promise<void> {
      const user = await authService.login(req.body);

      await regenerateSession(req);
      req.session.userId = user.id;

      res.status(200).json(user);
    },

    async logout(req: Request, res: Response): Promise<void> {
      await destroySession(req);

      res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions);
      res.status(204).end();
    },

    async me(req: Request, res: Response): Promise<void> {
      const user = await authService.getCurrentUser(
        getAuthenticatedUserId(req),
      );

      res.status(200).json(user);
    },
  };
}
