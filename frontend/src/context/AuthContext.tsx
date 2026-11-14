import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import {
  fetchFarmerProfileApi,
  loginFarmerApi,
  REFRESH_STORAGE_KEY,
  registerFarmerApi,
  TOKEN_STORAGE_KEY,
} from '../services/api';
import { geocodeLocationWithOSM } from '../services/geocoding';
import type { FarmerProfile } from '../types/farmer';

export type AuthStage = 'idle' | 'geocoding' | 'submitting' | 'authenticating';

interface AuthContextValue {
  accessToken: string | null;
  profile: FarmerProfile | null;
  isInitializing: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    params: { email: string; password: string; fullName: string; farmLocation: string },
    onStage?: (stage: AuthStage) => void,
  ) => Promise<void>;
  refreshProfile: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function extractApiError(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as Record<string, unknown> | undefined;
    if (data) {
      if (typeof data.detail === 'string') return data.detail;
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
      return 'Cannot reach the Django backend at http://localhost:8000. Ensure the server is running.';
    }
  }
  return err instanceof Error ? err.message : fallback;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY),
  );
  const [profile, setProfile] = useState<FarmerProfile | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(Boolean(accessToken));

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(REFRESH_STORAGE_KEY);
    setAccessToken(null);
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const data = await fetchFarmerProfileApi();
    setProfile(data);
  }, []);

  useEffect(() => {
    let active = true;
    if (!accessToken) {
      setIsInitializing(false);
      return;
    }

    fetchFarmerProfileApi()
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch(() => {
        if (active) logout();
      })
      .finally(() => {
        if (active) setIsInitializing(false);
      });

    return () => {
      active = false;
    };
  }, [accessToken, logout]);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const tokens = await loginFarmerApi(email.trim().toLowerCase(), password);
      localStorage.setItem(TOKEN_STORAGE_KEY, tokens.access);
      localStorage.setItem(REFRESH_STORAGE_KEY, tokens.refresh);
      setAccessToken(tokens.access);
      const userProfile = await fetchFarmerProfileApi();
      setProfile(userProfile);
    } catch (err) {
      throw new Error(extractApiError(err, 'Invalid email or password.'));
    }
  }, []);

  const register = useCallback(
    async (
      params: { email: string; password: string; fullName: string; farmLocation: string },
      onStage?: (stage: AuthStage) => void,
    ) => {
      onStage?.('geocoding');
      const geo = await geocodeLocationWithOSM(params.farmLocation);

      onStage?.('submitting');
      try {
        const res = await registerFarmerApi({
          email: params.email.trim().toLowerCase(),
          password: params.password,
          full_name: params.fullName.trim(),
          location_name: params.farmLocation.trim(),
          latitude: geo.latitude,
          longitude: geo.longitude,
        });
        localStorage.setItem(TOKEN_STORAGE_KEY, res.access);
        localStorage.setItem(REFRESH_STORAGE_KEY, res.refresh);
        setAccessToken(res.access);
        setProfile(res.profile);
      } catch (err) {
        throw new Error(extractApiError(err, 'Registration failed. Please check your inputs.'));
      } finally {
        onStage?.('idle');
      }
    },
    [],
  );

  return (
    <AuthContext.Provider
      value={{
        accessToken,
        profile,
        isInitializing,
        isAuthenticated: Boolean(accessToken && profile),
        login,
        register,
        refreshProfile,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
