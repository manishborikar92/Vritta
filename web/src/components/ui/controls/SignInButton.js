'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export default function SignInButton() {
  const { signInWithGoogle } = useAuth();
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    setPending(true);
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error('Sign in error:', err);
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      aria-busy={pending}
      className="flex min-h-10 min-w-21 items-center justify-center gap-2 rounded-xl bg-accent px-3.5 py-2 text-xs font-semibold text-white shadow-2xs transition-colors hover:bg-accent-hover disabled:opacity-50"
    >
      {pending && (
        <span
          aria-hidden="true"
          className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
        />
      )}
      <span>Sign In</span>
    </button>
  );
}
