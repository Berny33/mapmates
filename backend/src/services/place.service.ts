import type {
  GeocodingAdapter,
  PlaceSearchResult,
} from '../adapters/nominatim.adapter.js';

interface PlaceServiceDependencies {
  geocodingAdapter: GeocodingAdapter;
}

export function createPlaceService({
  geocodingAdapter,
}: PlaceServiceDependencies) {
  return {
    search(query: string): Promise<PlaceSearchResult[]> {
      return geocodingAdapter.searchPlaces(query);
    },
  };
}

export type PlaceService = ReturnType<typeof createPlaceService>;
