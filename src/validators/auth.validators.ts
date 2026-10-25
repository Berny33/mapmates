import { z } from 'zod';

const MAX_PASSWORD_BYTES = 72;

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(60),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  password: z
    .string()
    .min(8)
    .refine((value) => Buffer.byteLength(value, 'utf8') <= MAX_PASSWORD_BYTES, {
      message: 'Password must be at most 72 bytes',
    }),
});

export type RegisterInput = z.infer<typeof registerSchema>;
