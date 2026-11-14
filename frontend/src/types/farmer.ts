export interface FarmerProfile {
  id: number;
  email: string;
  full_name: string;
  location_name: string;
  latitude: number;
  longitude: number;
  created_at?: string;
}

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName: string;
}

export interface RegisterPayload {
  email: string;
  password: string;
  full_name: string;
  location_name: string;
  latitude: number;
  longitude: number;
}
