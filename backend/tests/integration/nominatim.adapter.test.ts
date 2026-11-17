import { describe, expect, it } from 'vitest';
import { createNominatimAdapter } from '../../src/adapters/nominatim.adapter.js';

describe('Nominatim adapter (US-08)', () => {
  it('sends an identifying User-Agent and maps place results', async () => {
    let requestUrl: URL | undefined;
    let requestAgent: string | null = null;
    const adapter = createNominatimAdapter({
      fetcher: async (input, init) => {
        requestUrl = new URL(input.toString());
        requestAgent = new Headers(init?.headers).get('User-Agent');
        return new Response(
          JSON.stringify([
            {
              name: 'Louvre Museum',
              display_name: 'Louvre Museum, Paris, France',
              lat: '48.8606',
              lon: '2.3376',
            },
          ]),
          { status: 200 },
        );
      },
      getUserAgent: () => 'MapMates/1.0 (contact@example.com)',
      now: () => 10_000,
    });

    await expect(adapter.searchPlaces('Louvre')).resolves.toEqual([
      {
        placeName: 'Louvre Museum',
        latitude: 48.8606,
        longitude: 2.3376,
      },
    ]);
    expect(requestUrl?.searchParams.get('q')).toBe('Louvre');
    expect(requestUrl?.searchParams.get('format')).toBe('jsonv2');
    expect(requestUrl?.searchParams.get('limit')).toBe('5');
    expect(requestAgent).toBe('MapMates/1.0 (contact@example.com)');
  });

  it('returns 429 when a second upstream request is attempted within one second [ST-24]', async () => {
    let currentTime = 20_000;
    let fetchCount = 0;
    const adapter = createNominatimAdapter({
      fetcher: async () => {
        fetchCount += 1;
        return new Response('[]', { status: 200 });
      },
      getUserAgent: () => 'MapMates/1.0 (contact@example.com)',
      now: () => currentTime,
    });

    await adapter.searchPlaces('Paris');
    await expect(adapter.searchPlaces('Tokyo')).rejects.toMatchObject({
      statusCode: 429,
      code: 'TOO_MANY_REQUESTS',
    });

    currentTime += 1000;
    await adapter.searchPlaces('Tokyo');
    expect(fetchCount).toBe(2);
  });

  it('maps upstream rate limiting to 429 and unavailability to 502 [ST-24, ST-25]', async () => {
    const rateLimited = createNominatimAdapter({
      fetcher: async () => new Response('', { status: 429 }),
      getUserAgent: () => 'MapMates/1.0 (contact@example.com)',
    });
    const unavailable = createNominatimAdapter({
      fetcher: async () => new Response('', { status: 503 }),
      getUserAgent: () => 'MapMates/1.0 (contact@example.com)',
    });
    const invalidResponse = createNominatimAdapter({
      fetcher: async () => new Response('invalid json', { status: 200 }),
      getUserAgent: () => 'MapMates/1.0 (contact@example.com)',
    });

    await expect(rateLimited.searchPlaces('Paris')).rejects.toMatchObject({
      statusCode: 429,
      code: 'TOO_MANY_REQUESTS',
    });
    await expect(unavailable.searchPlaces('Paris')).rejects.toMatchObject({
      statusCode: 502,
      code: 'GEOCODING_UNAVAILABLE',
    });
    await expect(invalidResponse.searchPlaces('Paris')).rejects.toMatchObject({
      statusCode: 502,
      code: 'GEOCODING_UNAVAILABLE',
    });
  });

  it('returns 502 when no identifying User-Agent is configured', async () => {
    let fetchCalled = false;
    const adapter = createNominatimAdapter({
      fetcher: async () => {
        fetchCalled = true;
        return new Response('[]', { status: 200 });
      },
      getUserAgent: () => '',
    });

    await expect(adapter.searchPlaces('Paris')).rejects.toMatchObject({
      statusCode: 502,
      code: 'GEOCODING_UNAVAILABLE',
    });
    expect(fetchCalled).toBe(false);
  });
});
