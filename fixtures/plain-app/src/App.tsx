import { ThemeProvider } from '@integr8-media/ui';
import {
  type AppWindowProps,
  useAppWindow,
  WindowManagerProvider,
  WindowManagerShell,
} from '@integr8-media/window-manager';
import { createWindowManager } from '@integr8-media/window-manager/core';
import { NotebookPen, Terminal } from 'lucide-react';

// The same app in every fixture: the whole desktop with two apps. fixtures.spec.ts opens a
// window, drags it, snaps it and uses the taskbar.
const manager = createWindowManager({
  apps: [
    { id: 'notes', title: 'Notes', icon: 'notes', size: { default: { width: 480, height: 320 } } },
    { id: 'terminal', title: 'Terminal', icon: 'terminal', placement: { pinned: true } },
  ],
});

function Notes(_props: AppWindowProps) {
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
    <ThemeProvider defaultTheme="light">
      <WindowManagerProvider manager={manager} apps={apps} icons={icons}>
        <WindowManagerShell />
      </WindowManagerProvider>
    </ThemeProvider>
  );
}
