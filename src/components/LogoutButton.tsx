'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface LogoutButtonProps {
  variant?: 'card' | 'minimal';
}

export default function LogoutButton({ variant = 'card' }: LogoutButtonProps) {
  const { signOut } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    await signOut();
    router.push('/');
    router.refresh();
  };

  if (variant === 'minimal') {
    return (
      <button
        onClick={handleLogout}
        disabled={loading}
        className="inline-flex items-center justify-center rounded-lg bg-[var(--color-primary)] text-white px-4 py-2 text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Signing out...' : 'Sign Out'}
      </button>
    );
  }

  return (
    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-8">
      <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">Sign Out</h2>
      <p className="text-[var(--color-text-muted)] mb-6">
        Sign out of your account on this device.
      </p>
      <button
        onClick={handleLogout}
        disabled={loading}
        className="inline-flex items-center justify-center rounded-lg bg-[var(--color-primary)] text-white px-4 py-2 text-sm font-medium hover:bg-[var(--color-primary-dark)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Signing out...' : 'Sign Out'}
      </button>
    </div>
  );
}
