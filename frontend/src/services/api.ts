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

// ---------------------------------------------------------------------------
// Lomura Precision Agriculture & FPO Suite API Services
// ---------------------------------------------------------------------------
export const dashboardService = {
  getMetrics: () => apiClient.get('/dashboard/metrics/'),
  getWeatherForecast: () => apiClient.get('/dashboard/weather-forecast/'),
  getPlotsHeatmap: () => apiClient.get('/dashboard/plots-heatmap/'),
  getYieldSpline: () => apiClient.get('/dashboard/yield-spline/'),
  getAlerts: () => apiClient.get('/dashboard/alerts/'),
  broadcastWarning: (payload: Record<string, unknown>) =>
    apiClient.post('/dashboard/broadcast/', payload),
};

export const profilerService = {
  getFieldProfile: (lat: number, lon: number) =>
    apiClient.get(`/field-profile/?lat=${lat}&lon=${lon}`),
  predictCrop: (params: Record<string, number>) =>
    apiClient.get('/predict-crop/', { params }),
};

export const simulatorService = {
  simulateRotation: (payload: Record<string, unknown>) =>
    apiClient.post('/simulate-rotation/', payload),
  checkNdvi: (lat: number, lon: number) =>
    apiClient.get(`/ndvi-check/?lat=${lat}&lon=${lon}`),
};

export const diagnosticsService = {
  scanImage: (formData: FormData) =>
    apiClient.post('/diagnostics/scan/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getSamples: () => apiClient.get('/diagnostics/samples/'),
};

export const voiceService = {
  processVoice: (formData: FormData) =>
    apiClient.post('/voice/process/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  sendChat: (queryText: string, language: string) =>
    apiClient.post('/voice/chat/', { query_text: queryText, language }),
  getVoiceSamples: (lang = 'ml') =>
    apiClient.get(`/voice/samples/?lang=${lang}`),
};

export const crmService = {
  getFarmers: (params: Record<string, string> = {}) =>
    apiClient.get('/crm/farmers/', { params }),
  getFarmerById: (id: number) => apiClient.get(`/crm/farmers/${id}/`),
  createFarmer: (payload: Record<string, unknown>) =>
    apiClient.post('/crm/farmers/', payload),
  updateFarmerRisk: (id: number, payload: Record<string, unknown>) =>
    apiClient.patch(`/crm/farmers/${id}/`, payload),
  deleteFarmer: (id: number) => apiClient.delete(`/crm/farmers/${id}/`),
};

export const schemesService = {
  getAllSchemes: () => apiClient.get('/schemes/'),
  matchSchemes: (payload: Record<string, string>) =>
    apiClient.post('/schemes/match/', payload),
};

