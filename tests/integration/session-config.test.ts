import { afterEach, describe, expect, it, vi } from 'vitest';

describe('session configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('refuses to start without SESSION_SECRET', async () => {
    vi.stubEnv('SESSION_SECRET', '');
    vi.resetModules();

    await expect(import('../../src/config/session.js')).rejects.toThrow(
      'SESSION_SECRET is not set',
    );
  });
});
