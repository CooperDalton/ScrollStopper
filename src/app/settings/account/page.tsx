import SettingsLayout from '@/components/SettingsLayout';

export default function AccountPage() {
  return (
    <SettingsLayout>
      <div className="flex-1 p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-text)] mb-2">Account</h1>
            <p className="text-[var(--color-text-muted)]">Manage your account settings.</p>
          </div>

          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-8">
            <h2 className="text-lg font-semibold text-[var(--color-text)] mb-4">Account Settings</h2>
            <p className="text-[var(--color-text-muted)]">Account management features coming soon.</p>
          </div>
        </div>
      </div>
    </SettingsLayout>
  );
}
