'use client';

import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function LogoutButton() {
  const { signOut } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    await signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-8">
      <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">Sign Out</h2>
      <p className="text-[var(--color-text-muted)] mb-6">
        Sign out of your account on this device.
      </p>
      <button
        onClick={handleLogout}
        disabled={loading}
        className="px-4 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-border)] text-[var(--color-text)] border border-[var(--color-border)] rounded-lg font-medium transition-colors disabled:opacity-50"
      >
        {loading ? 'Signing out...' : 'Sign Out'}
      </button>
    </div>
  );
}
