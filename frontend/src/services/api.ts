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

/**
 * API base URL resolution.
 *
 * `VITE_API_BASE_URL` is the canonical variable and should include the `/api` suffix,
 * e.g. `https://yeildary.onrender.com/api`.
 *
 * `VITE_API_URL` is also accepted (the name used in Render's docs) and is normalised to
 * always end with `/api`. Without either, requests fall back to the same-origin `/api`
 * path, which is what the Vite dev proxy (`vite.config.ts`) targets.
 */
const RAW_API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? import.meta.env.VITE_API_URL ?? '/api';

function normalizeApiBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '');
  if (!trimmed) {
    return '/api';
  }
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
}

export const API_BASE_URL = normalizeApiBaseUrl(RAW_API_BASE_URL);

/** Backend origin without the `/api` suffix (used for server-rendered pages such as password reset). */
export const BACKEND_BASE_URL = API_BASE_URL.replace(/\/api$/, '');

export const TOKEN_STORAGE_KEY = 'yieldary_jwt_access';
export const REFRESH_STORAGE_KEY = 'yieldary_jwt_refresh';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  // Required because the email/phone verification flow stores its state in the
  // Django session, which is a different origin from this app in production.
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

/** URL of the backend health check, which reports database/migration problems. */
export const HEALTH_URL = `${BACKEND_BASE_URL}/api/health/`;

/**
 * Turn an API failure into a message the user can act on.
 *
 * API errors are JSON, but a crashed backend or a blocked request produces HTML
 * or no response at all, so the UI would otherwise show Axios' raw
 * "Request failed with status code 500".
 */
export function describeApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const rawData = err.response?.data;
    const data =
      rawData && typeof rawData === 'object' && !Array.isArray(rawData)
        ? (rawData as Record<string, unknown>)
        : undefined;
    if (data) {
      if (typeof data.detail === 'string') return data.detail;
      if (typeof data.error === 'string' && data.error) return data.error;
      if (data.errors && typeof data.errors === 'object') {
        for (const errs of Object.values(data.errors as Record<string, unknown>)) {
          if (Array.isArray(errs) && typeof errs[0] === 'string') return errs[0];
          if (typeof errs === 'string') return errs;
        }
      }
      if (Array.isArray(data.non_field_errors) && typeof data.non_field_errors[0] === 'string') {
        return data.non_field_errors[0];
      }
      for (const value of Object.values(data)) {
        if (Array.isArray(value) && typeof value[0] === 'string') {
          return value[0];
        }
        if (typeof value === 'string') {
          return value;
        }
      }
    }
    if (!err.response) {
      return `Cannot reach the Django backend at ${API_BASE_URL}. Check that VITE_API_BASE_URL is correct and that the backend allows this origin (FRONTEND_URL).`;
    }
    if (err.response.status >= 500) {
      return `The backend at ${API_BASE_URL} failed to handle this request (HTTP ${err.response.status}). Open ${HEALTH_URL} to see whether the deployed database is reachable and migrated.`;
    }
  }
  return err instanceof Error ? err.message : fallback;
}

apiClient.interceptors.request.use((config) => {
  const token =
    localStorage.getItem(TOKEN_STORAGE_KEY) || sessionStorage.getItem(TOKEN_STORAGE_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data instanceof FormData) {
    delete config.headers['Content-Type'];
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
  const { data } = await apiClient.post<PhoneSendResponse>(
    '/phone/send-code/',
    { phone_number: phone },
    { timeout: 30000 },
  );
  return data;
}

export async function verifyPhoneCodeApi(phone: string, code: string): Promise<PhoneSendResponse> {
  const { data } = await apiClient.post<PhoneSendResponse>('/phone/verify-code/', {
    phone_number: phone,
    code,
  });
  return data;
}

export async function sendEmailCodeApi(email: string): Promise<PhoneSendResponse> {
  const { data } = await apiClient.post<PhoneSendResponse>(
    '/email/send-code/',
    { email },
    { timeout: 30000 },
  );
  return data;
}

export async function verifyEmailCodeApi(email: string, code: string): Promise<PhoneSendResponse> {
  const { data } = await apiClient.post<PhoneSendResponse>('/email/verify-code/', { email, code });
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
  const { data } = await apiClient.get<PlaceResult[]>('/location/search/', {
    params: { q, limit: 6 },
  });
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
  const { data } = await apiClient.post<FarmerSignupApiResponse>('/farmer/signup/', payload);
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
  scanImage: (data: FormData | Record<string, any>) =>
    apiClient.post('/diagnostics/scan/', data, {
      headers: data instanceof FormData ? { 'Content-Type': undefined } : undefined,
      timeout: 60000,
    }),
  getSamples: () => apiClient.get('/diagnostics/samples/'),
};

export const voiceService = {
  processVoice: (formData: FormData) =>
    apiClient.post('/voice/process/', formData, {
      headers: { 'Content-Type': undefined },
      timeout: 60000,
    }),
  sendChat: (
    queryText: string,
    language: string,
    history?: Array<{ sender: 'user' | 'bot'; text: string; intent?: string }>,
    kbIntent?: string,
  ) =>
    apiClient.post('/voice/chat/', {
      query_text: queryText,
      language,
      history,
      kb_intent: kbIntent,
    }),
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
