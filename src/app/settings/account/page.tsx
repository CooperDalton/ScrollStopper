import SettingsLayout from '@/components/SettingsLayout';
import CancelSubscriptionCard from '@/components/CancelSubscriptionCard';
import LogoutButton from '@/components/LogoutButton';

export default function AccountPage() {
  return (
    <SettingsLayout>
      <div className="flex-1 p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-[var(--color-text)] mb-2">Account</h1>
            <p className="text-[var(--color-text-muted)]">Manage your account settings.</p>
          </div>
          <CancelSubscriptionCard />
          <LogoutButton />
        </div>
      </div>
    </SettingsLayout>
  );
}
