'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '@/components/ui';

/**
 * Root page — redirect based on auth state:
 *   - Authenticated → /today
 *   - Unauthenticated → /login
 */
export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      router.replace(user ? '/today' : '/login');
    }
  }, [user, loading, router]);

  return <LoadingSpinner />;
}
