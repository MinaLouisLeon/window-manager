// The same app as the npm fixtures, built from the items `npx shadcn add` installed: the core in
// src/lib/window-manager/, the provider in src/hooks/ and the shell in src/components/ui/.
// The theme tokens come from the ui registry's `theme` item, installed into src/index.css.
import { NotebookPen, Terminal } from 'lucide-react';
import { WindowManagerShell } from '@/components/ui/window-manager-shell';
import { useAppWindow } from '@/hooks/use-app-window';
import { WindowManagerProvider } from '@/hooks/window-manager-provider';
import { createWindowManager } from '@/lib/window-manager';

const manager = createWindowManager({
  apps: [
    { id: 'notes', title: 'Notes', icon: 'notes', size: { default: { width: 480, height: 320 } } },
    { id: 'terminal', title: 'Terminal', icon: 'terminal', placement: { pinned: true } },
  ],
});

function Notes() {
  const win = useAppWindow();
  return (
    <textarea
      aria-label="Note"
      onChange={() => win.setDirty(true)}
      style={{ width: '100%', height: '100%' }}
    />
  );
}

const apps = { notes: Notes, terminal: () => <pre>$</pre> };
const icons = { notes: NotebookPen, terminal: Terminal };

export function App() {
  return (
    <WindowManagerProvider manager={manager} apps={apps} icons={icons}>
      <WindowManagerShell />
    </WindowManagerProvider>
  );
}
