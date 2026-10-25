import type { Request, Response } from 'express';
import type { AuthService } from '../services/auth.service.js';

export function createAuthController(authService: AuthService) {
  return {
    async register(req: Request, res: Response): Promise<void> {
      const user = await authService.register(req.body);

      res.status(201).json(user);
    },
  };
}
