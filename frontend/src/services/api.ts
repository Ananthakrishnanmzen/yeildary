import axios from 'axios';
import type {
  ClimateScenario,
  ConstraintWeights,
  FarmerProfile,
  Module3StrategyResponse,
  RegisterPayload,
  TelemetryReport,
  TerrainReport,
} from '../types/farmer';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export const TOKEN_STORAGE_KEY = 'yieldary_jwt_access';
export const REFRESH_STORAGE_KEY = 'yieldary_jwt_refresh';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface TokenResponse {
  access: string;
  refresh: string;
}

export interface RegisterResponse {
  message: string;
  profile: FarmerProfile;
  access: string;
  refresh: string;
}

export async function registerFarmerApi(payload: RegisterPayload): Promise<RegisterResponse> {
  const { data } = await apiClient.post<RegisterResponse>('/register/', payload);
  return data;
}

export async function loginFarmerApi(email: string, password: string): Promise<TokenResponse> {
  const { data } = await apiClient.post<TokenResponse>('/token/', {
    email,
    password,
  });
  return data;
}

export async function fetchFarmerProfileApi(): Promise<FarmerProfile> {
  const { data } = await apiClient.get<FarmerProfile>('/profile/');
  return data;
}


export interface PhoneSendResponse {
  ok: boolean;
  message?: string;
  phone_number?: string;
  dev_code?: string;
  error?: string;
}

export async function sendPhoneCodeApi(phone: string): Promise<PhoneSendResponse> {
  const { data } = await axios.post<PhoneSendResponse>('/api/phone/send-code/', { phone_number: phone });
  return data;
}

export async function verifyPhoneCodeApi(phone: string, code: string): Promise<PhoneSendResponse> {
  const { data } = await axios.post<PhoneSendResponse>('/api/phone/verify-code/', { phone_number: phone, code });
  return data;
}

export interface PlaceResult {
  name: string;
  display_name: string;
  lat: number;
  lon: number;
  type?: string;
}

export async function searchPlaceApi(q: string): Promise<PlaceResult[]> {
  const { data } = await axios.get<PlaceResult[]>('/api/location/search/', { params: { q, limit: 6 } });
  return Array.isArray(data) ? data : [];
}

export interface FarmerSignupApiPayload {
  user_type: string;
  name: string;
  email: string;
  phone_number: string;
  place_name: string;
  latitude: string;
  longitude: string;
  farm_area_acres: string;
  crops_grown: string;
  gender: string;
  age: string;
  preferred_language: string;
  password: string;
  confirm_password: string;
  terms_accepted: boolean;
}

export interface FarmerSignupApiResponse {
  ok: boolean;
  access?: string;
  refresh?: string;
  redirect?: string;
  errors?: Record<string, string[]>;
  error?: string;
}

export async function signupFarmerApi(payload: FarmerSignupApiPayload): Promise<FarmerSignupApiResponse> {
  const { data } = await axios.post<FarmerSignupApiResponse>('/api/farmer/signup/', payload);
  return data;
}

export async function fetchFarmerTelemetryApi(refresh = false): Promise<TelemetryReport> {
  const { data } = await apiClient.get<TelemetryReport>('/telemetry/', {
    params: refresh ? { refresh: '1' } : undefined,
    timeout: 90000,
  });
  return data;
}

export async function fetchFarmerTerrainApi(refresh = false): Promise<TerrainReport> {
  const { data } = await apiClient.get<TerrainReport>('/terrain/', {
    params: refresh ? { refresh: '1' } : undefined,
    timeout: 90000,
  });
  return data;
}

export async function fetchModule3StrategyApi(refresh = false): Promise<Module3StrategyResponse> {
  const { data } = await apiClient.get<Module3StrategyResponse>('/module3/strategy/', {
    params: refresh ? { refresh: '1' } : undefined,
    timeout: 30000,
  });
  return data;
}

export async function recalculateModule3StrategyApi(
  weights: ConstraintWeights,
  preferredLanguage?: string,
  climateScenario?: ClimateScenario,
): Promise<Module3StrategyResponse> {
  const { data } = await apiClient.post<Module3StrategyResponse>(
    '/module3/recalculate/',
    {
      ...weights,
      ...(climateScenario ?? {}),
      ...(preferredLanguage ? { preferred_language: preferredLanguage } : {}),
    },
    { timeout: 30000 },
  );
  return data;
}
