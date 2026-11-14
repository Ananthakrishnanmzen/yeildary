import React, { useState } from 'react';
import {
  AlertTriangle,
  Compass,
  Loader2,
  Lock,
  Mail,
  MapPin,
  Sprout,
  User,
} from 'lucide-react';
import { type AuthStage, useAuth } from '../context/AuthContext';

type AuthMode = 'login' | 'register';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [farmLocation, setFarmLocation] = useState('');

  const [stage, setStage] = useState<AuthStage>('idle');
  const [error, setError] = useState<string | null>(null);

  const isBusy = stage !== 'idle';

  const switchMode = (nextMode: AuthMode) => {
    if (isBusy) return;
    setMode(nextMode);
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!EMAIL_REGEX.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }

    if (mode === 'login') {
      if (!password) {
        setError('Please enter your password.');
        return;
      }
      setStage('authenticating');
      try {
        await login(email, password);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Login failed.');
      } finally {
        setStage('idle');
      }
      return;
    }

    if (!fullName.trim()) {
      setError('Full Name is required.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (!farmLocation.trim()) {
      setError('Farm Location (City/Village) is required.');
      return;
    }

    try {
      await register({ email, password, fullName, farmLocation }, setStage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed.');
      setStage('idle');
    }
  };

  const stageLabel =
    stage === 'geocoding'
      ? 'Resolving coordinates via OpenStreetMap...'
      : stage === 'submitting'
        ? 'Saving farm profile to Django...'
        : stage === 'authenticating'
          ? 'Verifying JWT credentials...'
          : '';

  return (
    <div className="relative min-h-screen bg-[#07090D] text-slate-100 flex items-center justify-center px-4 py-10 overflow-hidden">
      {/* Ambient Neon & Sky Glows */}
      <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#84CC16]/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-[#38BDF8]/10 blur-3xl" />

      <div className="relative w-full max-w-md rounded-3xl bg-[#0E1015]/80 backdrop-blur-xl border border-white/10 shadow-2xl p-6 sm:p-8">
        {/* Brand Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#84CC16]/15 border border-[#84CC16]/30 flex items-center justify-center text-[#84CC16]">
              <Sprout className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">Yieldary AI</h1>
              <p className="text-xs text-slate-400">Precision Agriculture Telemetry</p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/20">
            <Compass className="w-3 h-3" />
            OSM Ready
          </span>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#07090D] border border-white/10 mb-6">
          <button
            type="button"
            onClick={() => switchMode('register')}
            disabled={isBusy}
            className={`py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
              mode === 'register'
                ? 'bg-[#84CC16] text-[#07090D] shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Sign Up
          </button>
          <button
            type="button"
            onClick={() => switchMode('login')}
            disabled={isBusy}
            className={`py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer ${
              mode === 'login'
                ? 'bg-[#84CC16] text-[#07090D] shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Login
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start gap-2.5 rounded-xl border border-[#FACC15]/30 bg-[#FACC15]/10 px-3.5 py-3 text-xs sm:text-sm text-[#FACC15]"
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {mode === 'register' && (
            <div>
              <label htmlFor="fullName" className="block text-xs font-medium text-slate-300 mb-1.5">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Asha Devi"
                  disabled={isBusy}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#07090D]/80 border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#84CC16] focus:ring-1 focus:ring-[#84CC16]"
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-xs font-medium text-slate-300 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="farmer@yieldary.ai"
                disabled={isBusy}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#07090D]/80 border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#84CC16] focus:ring-1 focus:ring-[#84CC16]"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="block text-xs font-medium text-slate-300 mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'Minimum 6 characters' : 'Enter password'}
                disabled={isBusy}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#07090D]/80 border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#84CC16] focus:ring-1 focus:ring-[#84CC16]"
              />
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label
                htmlFor="farmLocation"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Farm Location (City / Village)
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="farmLocation"
                  type="text"
                  value={farmLocation}
                  onChange={(e) => setFarmLocation(e.target.value)}
                  placeholder="e.g. Kumily, Kerala"
                  disabled={isBusy}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#07090D]/80 border border-white/10 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-[#84CC16] focus:ring-1 focus:ring-[#84CC16]"
                />
              </div>
              <p className="mt-1.5 text-[11px] text-slate-400">
                Geocoded automatically via OpenStreetMap Nominatim before saving.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={isBusy}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[#84CC16] hover:bg-[#95dc26] disabled:opacity-60 text-[#07090D] font-bold py-3 px-4 text-sm transition-colors cursor-pointer"
          >
            {isBusy ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>{stageLabel}</span>
              </>
            ) : mode === 'register' ? (
              'Sign Up & Geocode Farm'
            ) : (
              'Login to Dashboard'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
