import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, MapPin, Sprout } from 'lucide-react';
import { type AuthStage, useAuth } from '../context/AuthContext';
import {
  searchPlaceApi,
  sendPhoneCodeApi,
  verifyPhoneCodeApi,
} from '../services/api';
import type { PlaceResult } from '../services/api';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INPUT_CLASS =
  'w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none transition focus:border-lime-400/70 focus:bg-white/[0.06] focus:ring-2 focus:ring-lime-400/20';
const SELECT_CLASS = `${INPUT_CLASS} appearance-none pr-10 bg-[#0F131A] text-white [&>option]:bg-[#0F131A] [&>option]:text-white`;

type AuthMode = 'login' | 'signup';

const GENDER_OPTIONS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'non_binary', label: 'Non-binary' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
  { value: 'other', label: 'Other' },
];

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'ml', label: 'Malayalam' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ta', label: 'Tamil' },
  { value: 'kn', label: 'Kannada' },
  { value: 'te', label: 'Telugu' },
  { value: 'other', label: 'Other' },
];

export default function AuthPage() {
  const { login, register } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showLoginPw, setShowLoginPw] = useState(false);

  const [userType, setUserType] = useState('farmer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('');
  const [phone, setPhone] = useState('');
  const [farmArea, setFarmArea] = useState('');
  const [age, setAge] = useState('');
  const [crops, setCrops] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('en');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const [phoneVerified, setPhoneVerified] = useState(false);
  const [verifiedPhone, setVerifiedPhone] = useState('');
  const [otpPanelOpen, setOtpPanelOpen] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [phoneStatus, setPhoneStatus] = useState("We'll send a 6-digit verification code.");
  const [devCode, setDevCode] = useState('');
  const [sendingCode, setSendingCode] = useState(false);
  const [verifyingCode, setVerifyingCode] = useState(false);

  const [placeQuery, setPlaceQuery] = useState('');
  const [placeResults, setPlaceResults] = useState<PlaceResult[]>([]);
  const [placeOpen, setPlaceOpen] = useState(false);
  const [placeName, setPlaceName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const searchTimer = useRef<number | null>(null);

  const [stage, setStage] = useState<AuthStage>('idle');
  const [error, setError] = useState<string | null>(null);

  const isBusy = stage !== 'idle' || sendingCode || verifyingCode;

  const passwordStrength = useMemo(() => {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
    if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score++;
    return score;
  }, [password]);

  useEffect(() => {
    if (searchTimer.current) window.clearTimeout(searchTimer.current);
    const q = placeQuery.trim();
    if (q.length < 2) {
      setPlaceResults([]);
      setPlaceOpen(false);
      return;
    }
    searchTimer.current = window.setTimeout(async () => {
      try {
        const res = await searchPlaceApi(q);
        setPlaceResults(res);
        setPlaceOpen(res.length > 0);
      } catch {
        setPlaceResults([]);
      }
    }, 350);
    return () => {
      if (searchTimer.current) window.clearTimeout(searchTimer.current);
    };
  }, [placeQuery]);

  const handleSendCode = async () => {
    setError(null);
    const normalized = phone.trim();
    if (!normalized) {
      setError('Enter a phone number first.');
      return;
    }
    setSendingCode(true);
    try {
      const res = await sendPhoneCodeApi(normalized);
      if (!res.ok) {
        setError(res.error || 'Could not send code.');
        return;
      }
      setPhone(res.phone_number || normalized);
      setOtpPanelOpen(true);
      setPhoneStatus(`Verification code sent to ${normalized}.`);
      if (res.dev_code) setDevCode(res.dev_code);
      else setDevCode('');
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Could not send code.');
    } finally {
      setSendingCode(false);
    }
  };

  const handleVerifyCode = async () => {
    setError(null);
    if (!otpCode.trim()) {
      setError('Enter the verification code.');
      return;
    }
    setVerifyingCode(true);
    try {
      const res = await verifyPhoneCodeApi(phone.trim(), otpCode.trim());
      if (!res.ok) {
        setError(res.error || 'Verification failed.');
        return;
      }
      setPhoneVerified(true);
      setVerifiedPhone(phone.trim());
      setOtpPanelOpen(false);
      setPhoneStatus('Phone number verified.');
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.message || 'Verification failed.');
    } finally {
      setVerifyingCode(false);
    }
  };

  const selectPlace = (p: PlaceResult) => {
    setPlaceQuery(p.name);
    setPlaceName(p.name);
    setLatitude(String(p.lat));
    setLongitude(String(p.lon));
    setPlaceOpen(false);
    setPlaceResults([]);
  };

  const resetMode = (next: AuthMode) => {
    if (isBusy) return;
    setMode(next);
    setError(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!EMAIL_REGEX.test(loginEmail.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!loginPassword) {
      setError('Please enter your password.');
      return;
    }
    setStage('authenticating');
    try {
      await login(loginEmail, loginPassword);
    } catch (err: any) {
      setError(err?.message || 'Login failed.');
    } finally {
      setStage('idle');
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (userType !== 'farmer') {
      setError('Only farmer accounts are available right now.');
      return;
    }
    if (!name.trim() || name.trim().length < 2) {
      setError('Enter your full name.');
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    if (!phoneVerified || verifiedPhone !== phone.trim()) {
      setError('Verify this phone number with the SMS code before creating your account.');
      return;
    }
    if (!placeName || !latitude || !longitude) {
      setError('Search for and select a place so we can capture its coordinates.');
      return;
    }
    if (!farmArea || Number(farmArea) <= 0) {
      setError('Enter a valid farm area.');
      return;
    }
    if (!crops.trim()) {
      setError('Add at least one crop you grow.');
      return;
    }
    if (!gender) {
      setError('Select your gender.');
      return;
    }
    const ageNum = Number(age);
    if (!age || ageNum < 13 || ageNum > 120) {
      setError('Enter a valid age.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The passwords do not match.');
      return;
    }
    if (!termsAccepted) {
      setError('You must accept the Terms of Service and Privacy Policy to create an account.');
      return;
    }

    setStage('submitting');
    try {
      await register(
        {
          userType,
          name,
          email,
          phoneNumber: phone,
          placeName,
          latitude,
          longitude,
          farmAreaAcres: farmArea,
          cropsGrown: crops,
          gender,
          age,
          preferredLanguage,
          password,
          confirmPassword,
          termsAccepted,
        },
        setStage,
      );
    } catch (err: any) {
      setError(err?.message || 'Registration failed.');
    } finally {
      setStage('idle');
    }
  };

  const EyeIcon = ({ open }: { open: boolean }) =>
    open ? (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.5 12C3.73 8.11 8 5 12 5s8.27 3.11 9.5 7c-1.23 3.89-5.5 7-9.5 7S3.73 15.89 2.5 12z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ) : (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3l18 18" />
        <path d="M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58" />
        <path d="M9.88 5.09A9.77 9.77 0 0112 5c5 0 9.27 3.11 10.5 7-.42 1.33-1.15 2.53-2.12 3.54" />
        <path d="M6.61 6.61C4.62 7.9 3.1 9.73 2.5 12c.64 2.03 2.05 3.76 3.87 5.06" />
      </svg>
    );

  return (
    <div className="min-h-screen bg-[#07090D] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8 sm:px-6">
        {mode === 'login' ? (
          <div className="mx-auto w-full max-w-md">
            <div className="glass rounded-3xl border border-white/10 p-6 shadow-2xl shadow-black/40 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-data text-[10px] uppercase tracking-[0.24em] text-lime-400">Login</p>
                  <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white">Welcome back</h1>
                  <p className="mt-2 text-sm text-slate-400">Sign in to open your farm dashboard.</p>
                </div>
                <span className="mt-1 hidden rounded-full border border-lime-400/25 bg-lime-400/10 px-3 py-1 font-data text-[9px] uppercase tracking-[0.18em] text-lime-400 sm:inline-flex">
                  Secure
                </span>
              </div>

              {error && (
                <div className="mt-5 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-400" role="alert">
                  {error}
                </div>
              )}

              <form onSubmit={handleLogin} className="mt-7 space-y-5" noValidate>
                <div>
                  <label className="mb-2 block text-xs font-medium text-slate-300">Email or username</label>
                  <input
                    type="text"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className={INPUT_CLASS}
                    placeholder="you@example.com or admin username"
                    autoComplete="username"
                    autoFocus
                  />
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="block text-xs font-medium text-slate-300">Password</label>
                    <a href="#" className="text-xs font-medium text-slate-400 transition hover:text-lime-400">Forgot password?</a>
                  </div>
                  <div className="relative">
                    <input
                      type={showLoginPw ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className={INPUT_CLASS}
                      placeholder="Enter your password"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPw((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-md p-1 text-slate-500 transition hover:text-lime-400"
                      aria-label="Show password"
                    >
                      <EyeIcon open={showLoginPw} />
                    </button>
                  </div>
                </div>

                <label className="flex cursor-pointer items-center gap-2.5 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-white/20 bg-white/5 text-lime-400 focus:ring-2 focus:ring-lime-400/40 focus:ring-offset-0"
                  />
                  <span>Keep me signed in on this device</span>
                </label>

                <button
                  type="submit"
                  disabled={isBusy}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl border border-lime-400/50 bg-lime-400/15 px-4 py-3 text-sm font-semibold text-lime-400 transition hover:border-lime-400/70 hover:bg-lime-400/25 focus:outline-none focus:ring-2 focus:ring-lime-400/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {stage === 'authenticating' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Sign in to dashboard
                      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true">
                        <path d="M4 10h12m0 0-4-4m4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-7 flex items-center gap-3">
                <span className="h-px flex-1 bg-white/10" />
                <span className="font-data text-[9px] uppercase tracking-[0.2em] text-slate-600">New here?</span>
                <span className="h-px flex-1 bg-white/10" />
              </div>

              <button
                onClick={() => resetMode('signup')}
                className="mt-5 flex w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-medium text-slate-200 transition hover:border-lime-400/30 hover:bg-lime-400/[0.06] hover:text-white"
              >
                Create a farmer account
              </button>
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-4xl">
            <div className="mb-8 lg:mb-10">
              <div className="inline-flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-2xl border border-lime-400/30 bg-lime-400/10 text-lime-400 shadow-[0_0_60px_-20px_rgba(132,204,22,0.45)]">
                  <Sprout className="h-6 w-6" />
                </span>
                <span>
                  <span className="block font-display text-xl font-semibold tracking-tight text-white">Yieldary AI</span>
                  <span className="block font-data text-[9px] uppercase tracking-[0.28em] text-slate-500">Field Shift</span>
                </span>
              </div>
              <h2 className="mt-6 font-display text-3xl font-semibold leading-tight tracking-tight text-white sm:text-4xl">
                Climate intelligence for the farm you actually work.
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400">
                NASA-powered water, soil and thermal signals translated into practical rotation guidance for your terrain.
              </p>
            </div>

            <div className="glass rounded-3xl border border-white/10 p-6 shadow-2xl shadow-black/40 sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-data text-[10px] uppercase tracking-[0.24em] text-lime-400">Farmer signup</p>
                  <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-white">Create your account</h1>
                  <p className="mt-2 text-sm text-slate-400">Set up your profile once. Your dashboard is built around it.</p>
                </div>
                <span className="mt-1 hidden rounded-full border border-sky-400/25 bg-sky-400/10 px-3 py-1 font-data text-[9px] uppercase tracking-[0.18em] text-sky-400 sm:inline-flex">
                  Step 1 of 1
                </span>
              </div>

              {error && (
                <div className="mt-5 rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-400" role="alert">
                  {error}
                </div>
              )}

              <form onSubmit={handleSignup} className="mt-7 space-y-8" noValidate>
                <section>
                  <div className="mb-4 flex items-center gap-3">
                    <span className="grid h-7 w-7 place-items-center rounded-lg border border-lime-400/30 bg-lime-400/10 font-data text-[10px] font-bold text-lime-400">01</span>
                    <h2 className="font-display text-sm font-semibold text-white">Account type</h2>
                  </div>
                  <label className="mb-2 block text-xs font-medium text-slate-300">I am a</label>
                  <div className="relative">
                    <select style={{colorScheme:'dark'}} value={userType} onChange={(e) => setUserType(e.target.value)} className={SELECT_CLASS}>
                      <option value="farmer">Farmer</option>
                    </select>
                  </div>
                  <p className="mt-2 text-[11px] text-slate-500">Researcher accounts are coming soon.</p>
                </section>

                <section className="space-y-6">
                  <div className="flex items-center gap-3">
                    <span className="grid h-7 w-7 place-items-center rounded-lg border border-lime-400/30 bg-lime-400/10 font-data text-[10px] font-bold text-lime-400">02</span>
                    <h2 className="font-display text-sm font-semibold text-white">Your details</h2>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-medium text-slate-300">Full name</label>
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CLASS} placeholder="e.g. Anitha Joseph" autoComplete="name" />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-medium text-slate-300">Email address</label>
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={INPUT_CLASS} placeholder="you@example.com" autoComplete="email" />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-medium text-slate-300">Gender</label>
                      <div className="relative">
                        <select style={{colorScheme:'dark'}} value={gender} onChange={(e) => setGender(e.target.value)} className={SELECT_CLASS}>
                          <option value="">Select gender</option>
                          {GENDER_OPTIONS.map((g) => (
                            <option key={g.value} value={g.value}>{g.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-medium text-slate-300">Phone number</label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <div className="min-w-0 flex-1">
                        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className={INPUT_CLASS} placeholder="+919876543210" autoComplete="tel" />
                      </div>
                      <button
                        type="button"
                        onClick={handleSendCode}
                        disabled={sendingCode || isBusy}
                        className="shrink-0 rounded-xl border border-lime-400/40 bg-lime-400/10 px-4 py-3 text-xs font-semibold text-lime-400 transition hover:bg-lime-400/20 focus:outline-none focus:ring-2 focus:ring-lime-400/30 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {sendingCode ? 'Sending...' : 'Send code'}
                      </button>
                    </div>

                    <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] leading-5 text-slate-400">{phoneStatus}</p>
                        {phoneVerified && (
                          <span className="inline-flex items-center gap-1 rounded-full border border-lime-400/30 bg-lime-400/10 px-2.5 py-1 font-data text-[9px] uppercase tracking-wider text-lime-400">
                            Verified
                          </span>
                        )}
                      </div>

                      {otpPanelOpen && (
                        <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={6}
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value)}
                            placeholder="6-digit code"
                            className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-center font-data text-sm tracking-[0.3em] text-white outline-none transition focus:border-lime-400/70 focus:ring-2 focus:ring-lime-400/20"
                          />
                          <button
                            type="button"
                            onClick={handleVerifyCode}
                            disabled={verifyingCode}
                            className="rounded-xl border border-lime-400/40 bg-lime-400/15 px-4 py-3 text-xs font-semibold text-lime-400 transition hover:bg-lime-400/25 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {verifyingCode ? 'Verifying...' : 'Verify'}
                          </button>
                        </div>
                      )}

                      {devCode && (
                        <p className="mt-3 font-data text-[10px] text-amber-400">Dev code: {devCode}</p>
                      )}
                      <p className="mt-2 text-[10px] leading-4 text-slate-600">
                        {phoneVerified ? 'Phone verified.' : "We'll send a 6-digit verification code."}
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-medium text-slate-300">Place / village</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={placeQuery}
                        onChange={(e) => {
                          setPlaceQuery(e.target.value);
                          if (!e.target.value) {
                            setPlaceName('');
                            setLatitude('');
                            setLongitude('');
                          }
                        }}
                        placeholder="Search for your village, town or farm location"
                        className={INPUT_CLASS}
                        autoComplete="off"
                      />
                      {placeOpen && placeResults.length > 0 && (
                        <div className="absolute z-30 mt-2 max-h-60 w-full overflow-auto rounded-xl border border-white/10 bg-[#0F131A]/95 p-1 shadow-2xl shadow-black/60 backdrop-blur-xl">
                          {placeResults.map((r, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => selectPlace(r)}
                              className="block w-full rounded-lg px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-lime-400/10"
                            >
                              <span className="block font-medium">{r.name}</span>
                              <span className="block font-data text-[9px] text-slate-500">{r.display_name}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    {placeName && latitude && longitude && (
                      <p className="mt-2 flex items-start gap-2 rounded-xl border border-sky-400/20 bg-sky-400/[0.07] px-3 py-2 text-[11px] text-sky-400">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>
                          <span className="block font-medium">{placeName}</span>
                          <span className="font-data text-[9px] text-sky-400/70">{latitude}, {longitude}</span>
                        </span>
                      </p>
                    )}
                    <p className="mt-2 text-[10px] text-slate-600">Select a search result so we can capture the latitude and longitude.</p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-medium text-slate-300">Farm area (acres)</label>
                      <input type="number" step="0.01" min="0.01" value={farmArea} onChange={(e) => setFarmArea(e.target.value)} className={INPUT_CLASS} placeholder="e.g. 2.5" />
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-medium text-slate-300">Age</label>
                      <input type="number" min="13" max="120" value={age} onChange={(e) => setAge(e.target.value)} className={INPUT_CLASS} placeholder="e.g. 42" />
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-medium text-slate-300">Crops grown</label>
                    <input type="text" value={crops} onChange={(e) => setCrops(e.target.value)} className={INPUT_CLASS} placeholder="e.g. Rice, Banana, Black pepper" />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {Array.from(
                        new Map(
                          crops.split(/[,;]/).map((c) => c.trim()).filter(Boolean).map((c) => [c.toLowerCase(), c]),
                        ).values(),
                      ).map((chip) => (
                        <span
                          key={chip}
                          className="inline-flex items-center rounded-full border border-lime-400/30 bg-lime-400/10 px-2.5 py-1 font-data text-[9px] uppercase tracking-wider text-lime-400"
                        >
                          {chip}
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-[10px] text-slate-600">Separate crops with commas, for example Rice, Banana, Black pepper.</p>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-medium text-slate-300">Preferred language</label>
                    <div className="relative">
                      <select style={{colorScheme:'dark'}} value={preferredLanguage} onChange={(e) => setPreferredLanguage(e.target.value)} className={SELECT_CLASS}>
                        {LANGUAGE_OPTIONS.map((l) => (
                          <option key={l.value} value={l.value}>{l.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </section>

                <section className="space-y-5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-7 w-7 place-items-center rounded-lg border border-lime-400/30 bg-lime-400/10 font-data text-[10px] font-bold text-lime-400">03</span>
                    <h2 className="font-display text-sm font-semibold text-white">Secure your account</h2>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-xs font-medium text-slate-300">Password</label>
                      <div className="relative">
                        <input
                          type={showPw ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className={INPUT_CLASS}
                          placeholder="Create a strong password"
                          autoComplete="new-password"
                        />
                        <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-md p-1 text-slate-500 transition hover:text-lime-400" aria-label="Show password">
                          <EyeIcon open={showPw} />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-xs font-medium text-slate-300">Confirm password</label>
                      <div className="relative">
                        <input
                          type={showConfirmPw ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className={INPUT_CLASS}
                          placeholder="Re-enter the new password"
                          autoComplete="new-password"
                        />
                        <button type="button" onClick={() => setShowConfirmPw((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center rounded-md p-1 text-slate-500 transition hover:text-lime-400" aria-label="Show password">
                          <EyeIcon open={showConfirmPw} />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="h-1 flex-1 rounded-full bg-white/10"><div className={`h-full rounded-full transition-all ${passwordStrength >= 1 ? 'bg-rose-400 w-full' : 'w-0'}`} /></div>
                    <div className="h-1 flex-1 rounded-full bg-white/10"><div className={`h-full rounded-full transition-all ${passwordStrength >= 2 ? 'bg-amber-400 w-full' : 'w-0'}`} /></div>
                    <div className="h-1 flex-1 rounded-full bg-white/10"><div className={`h-full rounded-full transition-all ${passwordStrength >= 3 ? 'bg-lime-400 w-full' : 'w-0'}`} /></div>
                    <span className="w-16 text-right font-data text-[9px] uppercase tracking-wider text-slate-600">Strength</span>
                  </div>

                  <label className="flex cursor-pointer items-start gap-3 text-xs leading-5 text-slate-400">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-white/20 bg-white/5 text-lime-400 focus:ring-2 focus:ring-lime-400/40 focus:ring-offset-0"
                    />
                    <span>
                      I agree to the{' '}
                      <a href="/terms/" target="_blank" rel="noopener" className="font-medium text-slate-200 underline decoration-white/25 underline-offset-4 transition hover:text-lime-400">Terms of Service</a>
                      {' '}and{' '}
                      <a href="/privacy/" target="_blank" rel="noopener" className="font-medium text-slate-200 underline decoration-white/25 underline-offset-4 transition hover:text-lime-400">Privacy Policy</a>.
                    </span>
                  </label>
                </section>

                {error && (
                  <div className="rounded-xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-400" role="alert">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isBusy}
                  className="group flex w-full items-center justify-center gap-2 rounded-xl border border-lime-400/50 bg-lime-400/15 px-4 py-3.5 text-sm font-semibold text-lime-400 transition hover:border-lime-400/70 hover:bg-lime-400/25 focus:outline-none focus:ring-2 focus:ring-lime-400/40 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {stage === 'submitting' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Create farmer account
                      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true">
                        <path d="M4 10h12m0 0-4-4m4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </>
                  )}
                </button>
              </form>

              <p className="mt-7 text-center text-xs text-slate-500">
                Already have an account?{' '}
                <button onClick={() => resetMode('login')} className="font-semibold text-lime-400 transition hover:underline">Sign in</button>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
