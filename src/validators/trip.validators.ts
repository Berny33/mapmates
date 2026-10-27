import { z } from 'zod';

export const createTripSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    destination: z.string().trim().min(1).max(100),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    type: z.enum(['solo', 'collaborative']),
  })
  .refine((trip) => trip.endDate >= trip.startDate, {
    message: 'End date must not be before start date',
    path: ['endDate'],
  });

export type CreateTripInput = z.infer<typeof createTripSchema>;
