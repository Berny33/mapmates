import { Router } from 'express';
import { createAuthController } from '../controllers/auth.controller.js';
import { createRateLimiter } from '../middlewares/rateLimit.js';
import { requireAuth } from '../middlewares/requireAuth.js';
import { validate } from '../middlewares/validate.js';
import { userModel } from '../models/user.model.js';
import { createAuthService } from '../services/auth.service.js';
import { loginSchema, registerSchema } from '../validators/auth.validators.js';

const router = Router();

const authController = createAuthController(createAuthService({ userModel }));

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.AUTH_RATE_LIMIT) || 10,
});

router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  authController.register,
);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/logout', requireAuth, authController.logout);
router.get('/me', requireAuth, authController.me);

export default router;
