import axios from 'axios';
import type { GeocodingResult } from '../types/farmer';

interface NominatimResult {
  lat: string;
  lon: string;
  display_name?: string;
}

export async function geocodeLocationWithOSM(locationQuery: string): Promise<GeocodingResult> {
  const trimmed = locationQuery.trim();
  if (!trimmed) {
    throw new Error('Please enter your farm location (city or village).');
  }

  try {
    const response = await axios.get<NominatimResult[]>(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(trimmed)}`,
      {
        headers: {
          Accept: 'application/json',
        },
        timeout: 12000,
      },
    );

    const results = response.data;
    if (!Array.isArray(results) || results.length === 0) {
      throw new Error('Location not found, please be more specific (e.g. add district or country).');
    }

    const first = results[0];
    const latitude = Number.parseFloat(first.lat);
    const longitude = Number.parseFloat(first.lon);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error('OpenStreetMap returned invalid coordinates. Please refine your location.');
    }

    return {
      latitude: Number(latitude.toFixed(6)),
      longitude: Number(longitude.toFixed(6)),
      displayName: first.display_name ?? trimmed,
    };
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.response?.status === 429) {
        throw new Error('OpenStreetMap rate limit reached. Please wait a moment and try again.');
      }
      throw new Error('Unable to reach OpenStreetMap geocoding service. Please try again.');
    }
    throw err;
  }
}
