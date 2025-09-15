import Sidebar from '@/components/Sidebar';
import SettingsSidebar from '@/components/SettingsSidebar';

interface SettingsLayoutProps {
  children: React.ReactNode;
}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  return (
    <div className="flex h-screen bg-[var(--color-bg)]">
      <Sidebar />
      <SettingsSidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
