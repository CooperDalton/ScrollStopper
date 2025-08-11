import AISidebar from '@/components/AISidebar';
import Sidebar from '@/components/Sidebar';

export default function AIEditorPage() {
  return (
    <div className="flex h-screen bg-[var(--color-bg)]">
      <Sidebar />
      <AISidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-8 text-[var(--color-text-muted)]">AI Editor workspace</div>
      </div>
    </div>
  );
}


