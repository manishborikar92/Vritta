'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  Activity,
  Headphones,
  Lock,
  ArrowRight,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner, Logo, ThemeToggle } from '@/components/ui';
import { BRAND } from '@/lib/constants/brand';

const pillars = [
  {
    Icon: BookOpen,
    title: 'Routine Architecture',
    description: 'Cultivate meaningful daily rhythms across life areas with clear, flexible cadences.',
    iconColor: 'text-teal-700 dark:text-teal-300',
    iconBg: 'bg-teal-50 dark:bg-teal-950/60 border border-teal-200/60 dark:border-teal-800/60',
  },
  {
    Icon: Activity,
    title: 'Adaptive Movement & Health',
    description: 'Track structured workouts, active recovery, and mobility aligned with your energy.',
    iconColor: 'text-teal-700 dark:text-teal-300',
    iconBg: 'bg-teal-50 dark:bg-teal-950/60 border border-teal-200/60 dark:border-teal-800/60',
  },
  {
    Icon: Headphones,
    title: 'Contemplative Focus',
    description: 'Structure mindful listening, reflective reading, and uninterrupted deep focus blocks.',
    iconColor: 'text-amber-700 dark:text-amber-400',
    iconBg: 'bg-amber-50 dark:bg-amber-950/60 border border-amber-200/60 dark:border-amber-800/60',
  },
  {
    Icon: Lock,
    title: 'Private Journal & Notes',
    description: 'Personal reflections, entries, and progress logs remain encrypted and private to your account.',
    iconColor: 'text-rose-700 dark:text-rose-400',
    iconBg: 'bg-rose-50 dark:bg-rose-950/60 border border-rose-200/60 dark:border-rose-800/60',
  },
];

export default function LoginPage() {
  const { user, loading, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [signingIn, setSigningIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(() => {
    if (!loading && user) {
      router.push('/today');
    }
  }, [user, loading, router]);

  if (loading || user) {
    return <LoadingSpinner />;
  }

  const handleSignIn = async () => {
    setSigningIn(true);
    setErrorMessage(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Sign in error:', err);
      if (err?.code !== 'auth/popup-closed-by-user') {
        setErrorMessage(err?.message || 'Unable to complete sign-in. Please try again.');
      }
    } finally {
      setSigningIn(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-canvas text-main selection:bg-accent-subtle selection:text-main transition-colors">
      {/* Top Header with Brand Mark and Quick Theme Toggle */}
      <header className="w-full max-w-4xl mx-auto px-4 py-4 sm:py-6 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-surface border border-subtle shadow-2xs flex items-center justify-center p-1.5 transition-colors">
            <Logo className="w-full h-full" />
          </div>
          <span className="font-bold text-base sm:text-lg tracking-tight text-main">
            {BRAND.name}
          </span>
        </div>

        {/* Accessible Theme Switcher */}
        <ThemeToggle />
      </header>

      {/* Main Authentication Card */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-6 sm:py-10">
        <div className="max-w-md w-full text-center">
          {/* Calm Centered Symbol Card — Zero Decorative Glow */}
          <div className="flex justify-center mb-6">
            <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-surface border border-subtle shadow-sm p-4 flex items-center justify-center transition-colors">
              <Logo className="w-full h-full" />
            </div>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-main tracking-tight leading-tight">
            {BRAND.name}
          </h1>

          <p className="text-sm sm:text-base text-sub font-medium tracking-wide mt-2 mb-8 max-w-sm mx-auto leading-relaxed">
            {BRAND.shortDescription}
          </p>

          {/* Error Banner */}
          {errorMessage && (
            <div
              role="alert"
              className="max-w-xs mx-auto mb-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2 text-left"
            >
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1 leading-snug">{errorMessage}</div>
            </div>
          )}

          {/* Tactile Google Sign-In Action */}
          <div className="w-full max-w-xs mx-auto">
            <button
              type="button"
              onClick={handleSignIn}
              disabled={signingIn}
              aria-busy={signingIn}
              className="w-full flex items-center justify-center gap-3 px-6 py-3.5 min-h-[48px] bg-surface text-main border border-subtle rounded-2xl hover:border-brand-primary/60 hover:bg-surface-subtle hover:shadow-xs active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed group shadow-2xs focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {signingIn ? (
                <div
                  className="animate-spin rounded-full h-5 w-5 border-2 border-subtle border-t-accent"
                  aria-hidden="true"
                />
              ) : (
                <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
              )}
              <span className="text-sm font-semibold tracking-tight text-main">
                {signingIn ? 'Signing in…' : 'Continue with Google'}
              </span>
              {!signingIn && (
                <ArrowRight className="w-4 h-4 text-muted group-hover:translate-x-0.5 transition-transform" aria-hidden="true" />
              )}
            </button>

            <p className="text-2xs text-muted mt-3 font-medium tracking-wide">
              Private & Encrypted • Offline-Ready • Zero Ads
            </p>
          </div>
        </div>

        {/* Four Routine Architecture Pillars */}
        <section
          aria-label="Core Capabilities"
          className="max-w-2xl w-full grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-10 px-2"
        >
          {pillars.map(({ Icon, title, description, iconColor, iconBg }) => (
            <div
              key={title}
              className="flex items-start gap-3.5 p-4 bg-surface rounded-2xl border border-subtle shadow-2xs hover:shadow-xs transition-shadow"
            >
              <div className={`p-2.5 rounded-xl ${iconBg} flex-shrink-0`}>
                <Icon className={`w-4 h-4 ${iconColor}`} aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="font-bold text-main text-xs sm:text-sm tracking-tight leading-snug">
                  {title}
                </h2>
                <p className="text-sub text-2xs sm:text-xs mt-1 leading-relaxed">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full text-center py-6 text-2xs text-muted border-t border-subtle/50 transition-colors">
        <p>{BRAND.name} — {BRAND.tagline}</p>
      </footer>
    </div>
  );
}
