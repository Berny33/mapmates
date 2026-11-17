import { z } from 'zod';

export const invitationParamsSchema = z.object({
  tripId: z.uuid(),
});
