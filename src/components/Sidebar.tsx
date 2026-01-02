'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import React, { useEffect, useState } from 'react';

// Icon components
const ProductsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
  </svg>
);

const EditorIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

const ImagesIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const SchedulerIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const SettingsIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const AIEditorIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="size-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
  </svg>
);

const UserIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const navigation = [
  { name: 'Products', href: '/products', icon: ProductsIcon },
  { name: 'Images', href: '/images', icon: ImagesIcon },
  { name: 'Editor', href: '/editor', icon: EditorIcon },
  { name: 'AI Editor', href: '/ai-editor', icon: AIEditorIcon },
  { name: 'Scheduler', href: '/scheduler', icon: SchedulerIcon },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [isSubscribed, setIsSubscribed] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      // 1. Try local storage first
      try {
        const cached = localStorage.getItem('subscription_status');
        if (cached) {
          const { isSubscribed: cachedStatus, timestamp } = JSON.parse(cached);
          // Use cached value immediately
          if (isMounted) setIsSubscribed(cachedStatus);
          
          // If cache is fresh (less than 5 minutes old), skip fetch
          if (Date.now() - timestamp < 1000 * 60 * 5) {
            return;
          }
        }
      } catch {}

      // 2. Fetch from API if needed
      try {
        const res = await fetch('/api/billing/status', { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const status = Boolean(data?.isSubscribed);
        
        if (isMounted) {
          setIsSubscribed(status);
          // Update cache
          localStorage.setItem('subscription_status', JSON.stringify({
            isSubscribed: status,
            timestamp: Date.now()
          }));
        }
      } catch {}
    };
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="flex h-screen w-64 flex-col bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)]">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2 px-6 py-6 border-b border-[var(--color-border)]">
        <img
          src="/Logos/LogoWBackground.png"
          alt="ScrollStopper Logo"
          className="w-8 h-8 object-contain rounded-lg"
        />
        <span className="text-xl font-bold text-[var(--color-text)]">ScrollStopper</span>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6">
        <ul className="space-y-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-[var(--color-primary)] text-white shadow-lg'
                      : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)]'
                  }`}
                >
                  <item.icon />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-[var(--color-border)] p-4 space-y-3">
        {/* Settings Button */}
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-all duration-200 text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-bg-tertiary)]"
          aria-label="Open Settings"
        >
          <SettingsIcon />
          Settings
        </Link>

        {/* Account Info */}
        <div className="bg-[var(--color-bg-tertiary)] rounded-xl p-4">
          <div className="flex items-center gap-3 mb-3">
            {user?.user_metadata?.avatar_url ? (
              <img
                src={user.user_metadata.avatar_url}
                alt="User avatar"
                className="w-8 h-8 rounded-full"
              />
            ) : (
              <div className="w-8 h-8 bg-[var(--color-primary)] rounded-full flex items-center justify-center">
                <UserIcon />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="text-sm font-medium text-[var(--color-text)] truncate">
                  {user?.user_metadata?.full_name || user?.email || 'Guest'}
                </div>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-emerald-600 text-white flex-shrink-0">
                  {isSubscribed ? 'Pro' : 'Free'}
                </span>
              </div>
              <div className="text-xs text-[var(--color-text-muted)]">
                {user?.email || 'Not signed in'}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 
