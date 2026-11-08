import request from 'supertest';
import app from '../../src/app.js';

export interface TestUser {
  name: string;
  email: string;
  password: string;
}

export function buildUser(overrides: Partial<TestUser> = {}): TestUser {
  return {
    name: 'Ana',
    email: 'ana@example.com',
    password: 'test-password-123',
    ...overrides,
  };
}

export async function loginAs(user: TestUser = buildUser()) {
  await request(app).post('/api/auth/register').send(user).expect(201);

  const agent = request.agent(app);
  await agent
    .post('/api/auth/login')
    .send({ email: user.email, password: user.password })
    .expect(200);

  return agent;
}
