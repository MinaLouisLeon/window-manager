import { Button, DropdownMenu, DropdownMenuTrigger } from '@integr8-media/ui';
import type { Story } from '@ladle/react';
import { type ReactElement, type ReactNode, useEffect } from 'react';
import type { ControlsStyle } from '../src/core/types';
import {
  CloseGuardDialog,
  Desktop,
  DesktopIcons,
  DesktopMenu,
  DesktopSwitcher,
  StartMenu,
  Taskbar,
  useDesktopSurface,
  useStartMenu,
  useWindowFrame,
  useWindowManager,
  useWindowSwitcher,
  Window,
  WindowControls,
  WindowMenu,
  WindowSwitcher,
  WindowTitleBar,
} from '../src/index';
import { AppIcon } from '../src/react/AppIcon';
import { DemoProvider, Frame } from './demo';

/** Reports the desktop size to the manager (what `Desktop` does), for stories without one. */
function Surface({ children }: { children: ReactNode }): ReactElement {
  const surface = useDesktopSurface();
  return (
    <div ref={surface.ref} className="absolute inset-0">
      {children}
    </div>
  );
}

function Note({ children }: { children: ReactNode }): ReactElement {
  return <p className="mb-3 text-sm text-muted-foreground">{children}</p>;
}

/** The id of the first open window (the stories open one). */
function useFirstWindowId(): string | null {
  return useWindowManager((state) => Object.keys(state.windows)[0] ?? null).state;
}

/** Sets the shell's controls style once. */
function useControlsStyle(style: ControlsStyle): void {
  const { manager } = useWindowManager((state) => state.shell.controlsStyle);
  useEffect(() => {
    manager.setShellSettings({ controlsStyle: style });
  }, [manager, style]);
}

// ---------- window ----------

function WindowBox({ children }: { children: ReactNode }): ReactElement {
  return (
    <Frame height="30rem">
      <Surface>{children}</Surface>
    </Frame>
  );
}

function OneWindow({
  controls = 'windows',
  extras = false,
}: {
  controls?: ControlsStyle;
  extras?: boolean;
}): ReactElement | null {
  const { manager } = useWindowManager((state) => state.shell.controlsStyle);
  const id = useFirstWindowId();
  useControlsStyle(controls);
  useEffect(() => {
    if (extras && id !== null) manager.update(id, { dirty: true, badge: 3 });
  }, [manager, extras, id]);
  if (id === null) return null;
  return (
    <Window
      windowId={id}
      {...(extras
        ? {
            titleBarSlots: {
              start: (
                <Button size="sm" variant="ghost">
                  File
                </Button>
              ),
              end: (
                <Button size="sm" variant="outline">
                  Share
                </Button>
              ),
            },
          }
        : {})}
    />
  );
}

export const WindowDefault: Story = () => (
  <DemoProvider options={{ windows: 1 }}>
    <Note>
      Drag the title bar, resize from any edge, double-click the title bar to maximize. Click the
      app icon or right-click the title bar for the window menu.
    </Note>
    <WindowBox>
      <OneWindow />
    </WindowBox>
  </DemoProvider>
);

export const WindowMacControls: Story = () => (
  <DemoProvider options={{ windows: 1 }}>
    <WindowBox>
      <OneWindow controls="mac" />
    </WindowBox>
  </DemoProvider>
);

export const WindowSlotsDirtyAndBadge: Story = () => (
  <DemoProvider options={{ windows: 1 }}>
    <Note>Title bar slots (start, end), the unsaved-changes dot and a badge.</Note>
    <WindowBox>
      <OneWindow extras />
    </WindowBox>
  </DemoProvider>
);

function ModalChildSetup(): ReactElement {
  const { manager, state } = useWindowManager((s) => Object.keys(s.windows));
  useEffect(() => {
    const [parent] = state;
    if (parent !== undefined && state.length === 1) {
      manager.open({ appId: 'about', parentId: parent, modal: true });
    }
  }, [manager, state]);
  return (
    <>
      {state.map((id) => (
        <Window key={id} windowId={id} />
      ))}
    </>
  );
}

export const WindowModalChild: Story = () => (
  <DemoProvider options={{ windows: 1 }}>
    <Note>The parent is blocked: pressing it focuses the modal child.</Note>
    <WindowBox>
      <ModalChildSetup />
    </WindowBox>
  </DemoProvider>
);

function TitleBarOnly({ controls }: { controls: ControlsStyle }): ReactElement | null {
  useControlsStyle(controls);
  const id = useFirstWindowId();
  if (id === null) return null;
  return <TitleBarAndControls id={id} />;
}

function TitleBarAndControls({ id }: { id: string }): ReactElement {
  const frame = useWindowFrame(id);
  return (
    <div className="flex flex-col gap-4">
      <div className="w-96 max-w-full overflow-hidden rounded-md border border-border bg-card">
        <WindowTitleBar frame={frame} />
      </div>
      <div className="w-fit rounded-md border border-border bg-card">
        <WindowControls frame={frame} />
      </div>
    </div>
  );
}

export const TitleBarAndControlsWindowsStyle: Story = () => (
  <DemoProvider options={{ windows: 1 }}>
    <TitleBarOnly controls="windows" />
  </DemoProvider>
);

export const TitleBarAndControlsMacStyle: Story = () => (
  <DemoProvider options={{ windows: 1 }}>
    <TitleBarOnly controls="mac" />
  </DemoProvider>
);

function WindowMenuButton(): ReactElement | null {
  const id = useFirstWindowId();
  if (id === null) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Window menu</Button>
      </DropdownMenuTrigger>
      <WindowMenu windowId={id} variant="dropdown" />
    </DropdownMenu>
  );
}

export const WindowMenuContent: Story = () => (
  <DemoProvider options={{ windows: 1 }}>
    <WindowMenuButton />
  </DemoProvider>
);

// ---------- desktop pieces ----------

export const DesktopSurface: Story = () => (
  <DemoProvider>
    <Note>
      Right-click the desktop for its menu. Drag a window to an edge or corner to see the snap
      preview.
    </Note>
    <Frame>
      <Desktop />
    </Frame>
  </DemoProvider>
);

export const DesktopIconsGrid: Story = () => (
  <DemoProvider options={{ windows: 0 }}>
    <Note>
      Arrow keys move between icons, Enter or a double-click opens, drag one onto another to
      reorder.
    </Note>
    <Frame height="24rem">
      <Surface>
        <DesktopIcons />
      </Surface>
    </Frame>
  </DemoProvider>
);

export const SnapPreviewZones: Story = () => (
  <DemoProvider options={{ windows: 1 }}>
    <Note>
      The desktop draws the snap preview box while a window is dragged near an edge or a corner (top
      edge: maximize).
    </Note>
    <Frame>
      <Desktop icons={false} />
    </Frame>
  </DemoProvider>
);

function DesktopMenuButton(): ReactElement {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Desktop menu</Button>
      </DropdownMenuTrigger>
      <DesktopMenu variant="dropdown" />
    </DropdownMenu>
  );
}

export const DesktopMenuContent: Story = () => (
  <DemoProvider options={{ windows: 0 }}>
    <Note>The desktop menu as a dropdown. On the desktop it opens with a right-click.</Note>
    <DesktopMenuButton />
  </DemoProvider>
);

// ---------- taskbar and menus ----------

function TaskbarBox({
  position,
  autoHide = false,
}: {
  position: 'bottom' | 'top' | 'left' | 'right';
  autoHide?: boolean;
}): ReactElement {
  return (
    <DemoProvider options={{ shell: { taskbarPosition: position, taskbarAutoHide: autoHide } }}>
      <Frame height="24rem">
        <Surface>
          <Taskbar />
          <StartMenu />
        </Surface>
      </Frame>
    </DemoProvider>
  );
}

export const TaskbarBottom: Story = () => <TaskbarBox position="bottom" />;
export const TaskbarTop: Story = () => <TaskbarBox position="top" />;
export const TaskbarLeft: Story = () => <TaskbarBox position="left" />;
export const TaskbarRight: Story = () => <TaskbarBox position="right" />;
export const TaskbarAutoHide: Story = () => <TaskbarBox position="bottom" autoHide />;

function OpenStartMenu(): null {
  const { setOpen } = useStartMenu();
  useEffect(() => {
    setOpen(true);
  }, [setOpen]);
  return null;
}

export const StartMenuOpen: Story = () => (
  <DemoProvider>
    <Frame height="30rem">
      <Surface>
        <Taskbar />
        <StartMenu />
        <OpenStartMenu />
      </Surface>
    </Frame>
  </DemoProvider>
);

export const DesktopSwitcherPopover: Story = () => (
  <DemoProvider options={{ desktops: 2 }}>
    <Note>Switch, rename, add and remove desktops.</Note>
    <DesktopSwitcher />
  </DemoProvider>
);

function Cycler(): ReactElement {
  const switcher = useWindowSwitcher();
  return (
    <Button size="sm" onClick={() => switcher.cycle()}>
      Cycle windows
    </Button>
  );
}

export const WindowSwitcherOverlay: Story = () => (
  <DemoProvider options={{ windows: 4 }}>
    <Note>
      Press the button, or hold Ctrl and press ` on the keyboard. Click an entry to focus it.
    </Note>
    <Cycler />
    <Frame height="20rem">
      <WindowSwitcher />
    </Frame>
  </DemoProvider>
);

// ---------- close guard ----------

function DirtyWindow(): ReactElement {
  const { manager } = useWindowManager((state) => state.focusedId);
  const id = useFirstWindowId();
  useEffect(() => {
    if (id !== null) manager.update(id, { dirty: true });
  }, [manager, id]);
  return (
    <>
      {id === null ? null : <Window windowId={id} />}
      <CloseGuardDialog />
    </>
  );
}

export const CloseGuard: Story = () => (
  <DemoProvider options={{ windows: 1 }}>
    <Note>The window has unsaved changes, so closing it asks first.</Note>
    <WindowBox>
      <DirtyWindow />
    </WindowBox>
  </DemoProvider>
);

// ---------- app icon ----------

const ICON_SVG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Ccircle cx='12' cy='12' r='10' fill='gray'/%3E%3C/svg%3E";

export const AppIconImage: Story = () => (
  <DemoProvider options={{ windows: 0 }}>
    <Note>
      Image icons ({'{ src, alt }'}) are drawn with ui's Avatar: the first icon loads, the second
      cannot, so it shows its fallback letter.
    </Note>
    <div className="flex items-center gap-4">
      <span className="size-10">
        <AppIcon icon={{ src: ICON_SVG, alt: 'Loaded icon' }} className="size-10" fallback="L" />
      </span>
      <span className="size-10">
        <AppIcon
          icon={{ src: '/does-not-exist.png', alt: 'Missing icon' }}
          className="size-10"
          fallback={<span className="text-lg font-medium">M</span>}
        />
      </span>
    </div>
  </DemoProvider>
);
