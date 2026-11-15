import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import {
  fetchFarmerProfileApi,
  loginFarmerApi,
  REFRESH_STORAGE_KEY,
  signupFarmerApi,
  TOKEN_STORAGE_KEY,
} from '../services/api';
import type { FarmerProfile } from '../types/farmer';

export type AuthStage = 'idle' | 'geocoding' | 'submitting' | 'authenticating';

interface AuthContextValue {
  accessToken: string | null;
  profile: FarmerProfile | null;
  isInitializing: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (
    params: {
      userType: string;
      name: string;
      email: string;
      phoneNumber: string;
      placeName: string;
      latitude: string;
      longitude: string;
      farmAreaAcres: string;
      cropsGrown: string;
      gender: string;
      age: string;
      preferredLanguage: string;
      password: string;
      confirmPassword: string;
      termsAccepted: boolean;
    },
    onStage?: (stage: AuthStage) => void,
  ) => Promise<void>;
  refreshProfile: () => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function extractApiError(err: unknown, fallback: string): string {
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
      return 'Cannot reach the Django backend at http://localhost:8000. Ensure the server is running.';
    }
    if (err.response.status >= 500) {
      return 'Server error (500). Please ensure database migrations are applied (python manage.py migrate).';
    }
  }
  return err instanceof Error ? err.message : fallback;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_STORAGE_KEY) || sessionStorage.getItem(TOKEN_STORAGE_KEY),
  );
  const [profile, setProfile] = useState<FarmerProfile | null>(null);
  const [isInitializing, setIsInitializing] = useState<boolean>(Boolean(accessToken));

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(REFRESH_STORAGE_KEY);
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(REFRESH_STORAGE_KEY);
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

  const login = useCallback(async (email: string, password: string, rememberMe = true) => {
    try {
      const tokens = await loginFarmerApi(email.trim().toLowerCase(), password);
      const storage = rememberMe ? localStorage : sessionStorage;
      // Clear the other storage to avoid stale tokens
      (rememberMe ? sessionStorage : localStorage).removeItem(TOKEN_STORAGE_KEY);
      (rememberMe ? sessionStorage : localStorage).removeItem(REFRESH_STORAGE_KEY);
      storage.setItem(TOKEN_STORAGE_KEY, tokens.access);
      storage.setItem(REFRESH_STORAGE_KEY, tokens.refresh);
      setAccessToken(tokens.access);
      const userProfile = await fetchFarmerProfileApi();
      setProfile(userProfile);
    } catch (err) {
      throw new Error(extractApiError(err, 'Invalid email or password.'));
    }
  }, []);

  const register = useCallback(
    async (
      params: {
        userType: string;
        name: string;
        email: string;
        phoneNumber: string;
        placeName: string;
        latitude: string;
        longitude: string;
        farmAreaAcres: string;
        cropsGrown: string;
        gender: string;
        age: string;
        preferredLanguage: string;
        password: string;
        confirmPassword: string;
        termsAccepted: boolean;
      },
      onStage?: (stage: AuthStage) => void,
    ) => {
      onStage?.('submitting');
      try {
        const res = await signupFarmerApi({
          user_type: params.userType,
          name: params.name.trim(),
          email: params.email.trim().toLowerCase(),
          phone_number: params.phoneNumber.trim(),
          place_name: params.placeName.trim(),
          latitude: params.latitude,
          longitude: params.longitude,
          farm_area_acres: params.farmAreaAcres,
          crops_grown: params.cropsGrown,
          gender: params.gender,
          age: params.age,
          preferred_language: params.preferredLanguage,
          password: params.password,
          confirm_password: params.confirmPassword,
          terms_accepted: params.termsAccepted,
        });
        if (!res.ok || !res.access || !res.refresh) {
          const msg = res.errors
            ? Object.values(res.errors).flat()[0] || res.error || 'Registration failed.'
            : res.error || 'Registration failed.';
          throw new Error(msg);
        }
        localStorage.setItem(TOKEN_STORAGE_KEY, res.access);
        localStorage.setItem(REFRESH_STORAGE_KEY, res.refresh);
        setAccessToken(res.access);
        const userProfile = await fetchFarmerProfileApi();
        setProfile(userProfile);
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
