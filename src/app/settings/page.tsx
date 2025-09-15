'use client';

import React from 'react';
import SettingsLayout from '@/components/SettingsLayout';

export default function SettingsHomePage() {
  return (
    <SettingsLayout>
      <div className="flex-1 p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-8">
            <h1 className="text-3xl font-bold text-[var(--color-text)] mb-4">Welcome to Settings</h1>
            <p className="text-[var(--color-text-muted)] mb-6">
              Use the sidebar to navigate between different settings sections.
            </p>
            <div className="text-sm text-[var(--color-text-muted)]">
              Select an option from the settings menu to get started.
            </div>
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
}


