'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ConfirmDialog from './ConfirmDialog';

export default function SignOutDialog({ isOpen, onClose }) {
  const { logout } = useAuth();
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleConfirm = async () => {
    setPending(true);
    try {
      await logout();
      onClose();
      // replace, not push: Back must not return to a signed-in screen
      router.replace('/login');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setPending(false);
    }
  };

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={onClose}
      onConfirm={handleConfirm}
      title="Sign Out?"
      message="Are you sure you want to sign out? Your offline and synced data remains securely saved on your account."
      confirmText="Sign Out"
      isDanger
      isLoading={pending}
    />
  );
}
