import { Button } from '@integr8-media/ui';
import { Calculator, Folder, Info, NotebookPen, RefreshCw, Terminal, Wifi } from 'lucide-react';
import { type ComponentType, type ReactElement, type ReactNode, useEffect, useState } from 'react';
import { createWindowManager } from '../src/core/createWindowManager';
import type { AppDefinition, ShellSettings, WindowManager } from '../src/core/types';
import {
  type AppWindowProps,
  type IconComponent,
  useAppWindow,
  WindowManagerProvider,
} from '../src/index';

/** Demo apps used by every story. */
export const DEMO_APPS: AppDefinition[] = [
  {
    id: 'notes',
    title: 'Notes',
    icon: 'notes',
    size: { default: { width: 560, height: 420 } },
    placement: {
      pinned: true,
      startMenu: { category: 'Productivity', keywords: ['text', 'write'] },
    },
  },
  {
    id: 'terminal',
    title: 'Terminal',
    icon: 'terminal',
    size: { default: { width: 520, height: 320 } },
    placement: { pinned: true, startMenu: { category: 'System', keywords: ['shell', 'console'] } },
  },
  {
    id: 'counter',
    title: 'Counter',
    icon: 'counter',
    size: { default: { width: 320, height: 220 } },
    placement: { startMenu: { category: 'Productivity' } },
  },
  {
    id: 'files',
    title: 'Files',
    icon: 'files',
    size: { default: { width: 480, height: 360 } },
    instances: { max: 3 },
    placement: { startMenu: { category: 'System' } },
  },
  {
    id: 'about',
    title: 'About',
    icon: 'about',
    size: { default: { width: 320, height: 180 }, resizable: false },
    controlsStyle: 'windows',
    placement: { desktop: false, startMenu: false },
  },
];

function Notes({ data }: AppWindowProps<{ text?: string } | undefined>): ReactElement {
  const win = useAppWindow<{ text?: string } | undefined>();
  const { setSaveHandler, setDirty } = win;
  // The close dialog of a window with unsaved text then offers "Save".
  useEffect(() => {
    setSaveHandler(() => setDirty(false));
    return () => setSaveHandler(null);
  }, [setSaveHandler, setDirty]);
  return (
    <div className="flex h-full flex-col gap-2 p-2">
      <textarea
        aria-label="Note"
        className="min-h-0 flex-1 resize-none rounded-md border border-input bg-background p-2 text-sm text-foreground"
        defaultValue={data?.text ?? ''}
        placeholder="Type here: the window gets an unsaved-changes dot."
        onChange={(event) => {
          win.setData({ text: event.target.value });
          win.setDirty(true);
        }}
      />
      <div className="flex justify-end">
        <Button size="sm" onClick={() => win.setDirty(false)}>
          Save
        </Button>
      </div>
    </div>
  );
}

function TerminalApp(): ReactElement {
  return (
    <pre className="h-full overflow-auto bg-background p-3 font-mono text-sm text-foreground">
      {'$ window-manager --version\n@integr8-media/window-manager\n$ '}
    </pre>
  );
}

function CounterApp(): ReactElement {
  const win = useAppWindow();
  const [count, setCount] = useState(0);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-4">
      <p className="text-3xl font-semibold tabular-nums">{count}</p>
      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => {
            setCount(count + 1);
            win.setBadge(count + 1);
          }}
        >
          Add
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setCount(0);
            win.setBadge(null);
          }}
        >
          Reset
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">State is lost while the window is minimized.</p>
    </div>
  );
}

function FilesApp(): ReactElement {
  const win = useAppWindow();
  return (
    <div className="flex h-full flex-col items-start gap-3 p-4 text-sm">
      <p>Open a modal child window: it blocks this window until it is closed.</p>
      <Button size="sm" onClick={() => win.open({ appId: 'about', parentId: win.id, modal: true })}>
        Open About (modal)
      </Button>
    </div>
  );
}

function AboutApp(): ReactElement {
  const win = useAppWindow();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center text-sm">
      <p>A modal child window.</p>
      <Button size="sm" onClick={() => void win.close()}>
        Close
      </Button>
    </div>
  );
}

/** Components of the demo apps, by app id. Stable, as the provider needs. */
export const DEMO_COMPONENTS: Record<string, ComponentType<AppWindowProps>> = {
  notes: Notes as ComponentType<AppWindowProps>,
  terminal: TerminalApp,
  counter: CounterApp,
  files: FilesApp,
  about: AboutApp,
};

/** Icons of the demo apps, by key. Stable, as the provider needs. */
export const DEMO_ICONS: Record<string, IconComponent> = {
  notes: NotebookPen,
  terminal: Terminal,
  counter: Calculator,
  files: Folder,
  about: Info,
};

/** Options of `createDemoManager`. */
export interface DemoOptions {
  /** How many windows to open at the start (apps in turn). Default 3. */
  windows?: number;
  shell?: Partial<ShellSettings>;
  /** Number of desktops. Default 1. */
  desktops?: number;
  /** Register a few notification area items (network, sync). Default false. */
  tray?: boolean;
  /**
   * Start with notifications: `true` for four (one of each level, one with an action), or a
   * number for that many (to see the list scroll). Default none.
   */
  notifications?: boolean | number;
}

const CYCLE = ['notes', 'terminal', 'counter', 'notes', 'terminal', 'counter'];

/** A manager with the demo apps and some windows already open. */
export function createDemoManager({
  windows = 3,
  shell,
  desktops = 1,
  tray = false,
  notifications = false,
}: DemoOptions = {}): WindowManager {
  const manager = createWindowManager({
    apps: DEMO_APPS,
    ...(shell === undefined ? {} : { shell }),
    desktops: Array.from({ length: desktops }, (_, index) => ({ name: `Desktop ${index + 1}` })),
  });
  for (let index = 0; index < windows; index += 1) {
    manager.open({ appId: CYCLE[index % CYCLE.length] as string });
  }
  if (tray) {
    manager.registerTrayItem({ id: 'network', label: 'Network', icon: <Wifi />, order: 1 });
    manager.registerTrayItem({
      id: 'sync',
      label: 'Sync',
      icon: <RefreshCw />,
      badge: 2,
      order: 2,
      appId: 'files',
    });
  }
  if (typeof notifications === 'number') {
    const levels = ['info', 'success', 'warning', 'error'] as const;
    for (let index = 0; index < notifications; index += 1) {
      const long = 'A longer message that wraps onto a second line.';
      manager.notify({
        title: `Notification ${index + 1}`,
        body: index % 2 === 0 ? 'A short message.' : long,
        level: levels[index % levels.length] as (typeof levels)[number],
      });
    }
  } else if (notifications) {
    manager.notify({ title: 'Welcome', body: 'The desktop is ready.', level: 'info' });
    manager.notify({ title: 'Backup finished', level: 'success', appId: 'files' });
    manager.notify({
      title: 'Disk almost full',
      body: '92% of the space is used.',
      level: 'warning',
    });
    manager.notify({
      title: 'Sync failed',
      level: 'error',
      action: { label: 'Open Files', open: { appId: 'files' } },
    });
  }
  return manager;
}

/** Creates one demo manager for the story and provides it with the demo apps and icons. */
export function DemoProvider({
  options,
  children,
}: {
  options?: DemoOptions;
  children: ReactNode;
}): ReactElement {
  const [manager] = useState(() => createDemoManager(options));
  return (
    <WindowManagerProvider manager={manager} apps={DEMO_COMPONENTS} icons={DEMO_ICONS}>
      {children}
    </WindowManagerProvider>
  );
}

/** A sized, positioned box to hold a desktop inside the story page. */
export function Frame({
  children,
  height = 'calc(100dvh - 7rem)',
}: {
  children: ReactNode;
  height?: string;
}): ReactElement {
  return (
    <div
      className="relative min-h-104 overflow-hidden rounded-lg border border-border"
      style={{ height }}
    >
      {children}
    </div>
  );
}
