import { z } from 'zod';

export const invitationParamsSchema = z.object({
  tripId: z.uuid(),
});

export const invitationTokenParamsSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
});
