import { z } from 'zod';

const proposalCategories = [
  'food',
  'sightseeing',
  'culture',
  'nature',
  'nightlife',
  'shopping',
  'transport',
  'other',
] as const;

const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

export const proposalParamsSchema = z.object({
  tripId: z.uuid(),
});

export const placeSearchSchema = z.object({
  q: z.string().trim().min(2).max(100),
});

export const createProposalSchema = z
  .object({
    placeName: z.string().trim().min(1).max(200),
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
    category: z.enum(proposalCategories),
    day: z.iso.date(),
    startTime: z.string().regex(timePattern),
    endTime: z.string().regex(timePattern),
    note: z.string().trim().max(280).optional(),
    votingDurationHours: z.number().int().min(1).max(72),
  })
  .refine((proposal) => proposal.endTime > proposal.startTime, {
    message: 'End time must be later than start time',
    path: ['endTime'],
  });

export type CreateProposalInput = z.infer<typeof createProposalSchema>;
