import { z } from 'zod';
import { AppError } from '../utils/AppError.js';

const MIN_REQUEST_INTERVAL_MS = 1000;
const MAX_RESULTS = 5;

const nominatimResultSchema = z.array(
  z.object({
    display_name: z.string(),
    lat: z.string(),
    lon: z.string(),
    name: z.string().nullish(),
  }),
);

export interface PlaceSearchResult {
  placeName: string;
  latitude: number;
  longitude: number;
}

export interface GeocodingAdapter {
  searchPlaces(query: string): Promise<PlaceSearchResult[]>;
}

interface NominatimAdapterDependencies {
  fetcher?: typeof fetch;
  getUserAgent?: () => string | undefined;
  now?: () => number;
}

export function createNominatimAdapter({
  fetcher = (...args) => fetch(...args),
  getUserAgent = () => process.env.GEOCODING_USER_AGENT,
  now = () => Date.now(),
}: NominatimAdapterDependencies = {}): GeocodingAdapter {
  let lastRequestAt: number | null = null;

  return {
    async searchPlaces(query: string): Promise<PlaceSearchResult[]> {
      const currentTime = now();
      if (
        lastRequestAt !== null &&
        currentTime - lastRequestAt < MIN_REQUEST_INTERVAL_MS
      ) {
        throw new AppError(
          429,
          'TOO_MANY_REQUESTS',
          'Please wait before searching for another place',
        );
      }

      const userAgent = getUserAgent()?.trim();
      if (!userAgent) {
        throw new AppError(
          502,
          'GEOCODING_UNAVAILABLE',
          'Place search is not configured',
        );
      }

      lastRequestAt = currentTime;

      try {
        const url = new URL('https://nominatim.openstreetmap.org/search');
        url.searchParams.set('q', query);
        url.searchParams.set('format', 'jsonv2');
        url.searchParams.set('limit', String(MAX_RESULTS));
        url.searchParams.set('addressdetails', '0');

        const response = await fetcher(url, {
          headers: {
            Accept: 'application/json',
            'User-Agent': userAgent,
          },
          signal: AbortSignal.timeout(5000),
        });

        if (response.status === 429) {
          throw new AppError(
            429,
            'TOO_MANY_REQUESTS',
            'Place search rate limit exceeded',
          );
        }

        if (!response.ok) {
          throw new AppError(
            502,
            'GEOCODING_UNAVAILABLE',
            'Place search is temporarily unavailable',
          );
        }

        const parsed = nominatimResultSchema.safeParse(await response.json());
        if (!parsed.success) {
          throw new AppError(
            502,
            'GEOCODING_UNAVAILABLE',
            'Place search returned invalid results',
          );
        }

        return parsed.data.flatMap((place) => {
          const latitude = Number(place.lat);
          const longitude = Number(place.lon);
          const placeName = (place.name?.trim() || place.display_name.trim())
            .slice(0, 200)
            .trim();

          if (
            !placeName ||
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
          ) {
            return [];
          }

          return [{ placeName, latitude, longitude }];
        });
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }

        throw new AppError(
          502,
          'GEOCODING_UNAVAILABLE',
          'Place search is temporarily unavailable',
        );
      }
    },
  };
}

export const nominatimAdapter = createNominatimAdapter();
