import { z } from 'zod';

const MAX_PASSWORD_BYTES = 72;

const emailField = z.string().trim().toLowerCase().max(254).pipe(z.email());

const fitsBcrypt = (value: string): boolean =>
  Buffer.byteLength(value, 'utf8') <= MAX_PASSWORD_BYTES;

const passwordTooLong = { message: 'Password must be at most 72 bytes' };

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(60),
  email: emailField,
  password: z.string().min(8).refine(fitsBcrypt, passwordTooLong),
});

export const loginSchema = z.object({
  email: emailField,
  password: z.string().min(1).refine(fitsBcrypt, passwordTooLong),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
