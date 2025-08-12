import Sidebar from '@/components/Sidebar';
import AIEditorWorkspace from '@/components/AIEditorWorkspace';

export default function AIEditorPage() {
  return (
    <div className="flex h-screen bg-[var(--color-bg)]">
      <Sidebar />
      <AIEditorWorkspace />
    </div>
  );
}


