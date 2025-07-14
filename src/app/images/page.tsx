import DashboardLayout from '../components/DashboardLayout';

export default function ImagesPage() {
  return (
    <DashboardLayout>
      <div className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-[var(--color-text)] mb-6">Images</h1>
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-8 text-center">
            <p className="text-[var(--color-text-muted)]">Images page coming soon...</p>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
} 