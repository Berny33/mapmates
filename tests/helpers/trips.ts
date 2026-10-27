import { loginAs } from './auth.js';

type Agent = Awaited<ReturnType<typeof loginAs>>;

export const validTrip = {
  name: 'Paris',
  destination: 'Paris, France',
  startDate: '2026-12-01',
  endDate: '2026-12-05',
  type: 'collaborative',
};

export async function createTrip(
  agent: Agent,
  overrides: Record<string, unknown> = {},
) {
  const res = await agent
    .post('/api/trips')
    .send({ ...validTrip, ...overrides })
    .expect(201);

  return res.body as { id: string; name: string; role: string };
}
