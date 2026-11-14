import axios from 'axios';
import type { FarmerProfile, RegisterPayload } from '../types/farmer';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api';

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
