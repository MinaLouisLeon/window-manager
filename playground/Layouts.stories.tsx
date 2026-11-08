import type { Story } from '@ladle/react';
import { type ReactElement, type ReactNode, useEffect, useRef } from 'react';
import type { Wallpaper } from '../src/core/types';
import {
  Desktop,
  useDesktopOverview,
  useWindowManager,
  WallpaperPicker,
  WindowManagerShell,
} from '../src/index';
import { DemoProvider, Frame } from './demo';

function Note({ children }: { children: ReactNode }): ReactElement {
  return <p className="mb-3 text-sm text-muted-foreground">{children}</p>;
}

/** Moves the open windows onto the desktops in turn, so each desktop has some. */
function useSpreadWindows(): void {
  const { manager, state: desktopIds } = useWindowManager((state) =>
    state.desktops.map((desktop) => desktop.id).join(','),
  );
  useEffect(() => {
    const ids = desktopIds.split(',');
    Object.keys(manager.getState().windows).forEach((windowId, index) => {
      manager.moveToDesktop(windowId, ids[index % ids.length] as string);
    });
  }, [manager, desktopIds]);
}

/** Opens the overview once, when it is mounted (it stays closed after the user closes it). */
function OpenOverview(): null {
  const overview = useDesktopOverview();
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    overview.setOpen(true);
  });
  return null;
}

function SpreadShell({ open = false }: { open?: boolean }): ReactElement {
  useSpreadWindows();
  return (
    <WindowManagerShell className="h-full">{open ? <OpenOverview /> : null}</WindowManagerShell>
  );
}

const WALLPAPERS: Wallpaper[] = [
  { type: 'gradient', value: 'linear-gradient(135deg, var(--primary), var(--accent))' },
  { type: 'color', value: 'var(--muted)' },
  { type: 'gradient', value: 'radial-gradient(circle at top, var(--accent), var(--background))' },
];

/** Gives each desktop a different wallpaper. */
function useWallpapers(): void {
  const { manager, state: desktopIds } = useWindowManager((state) =>
    state.desktops.map((desktop) => desktop.id).join(','),
  );
  useEffect(() => {
    desktopIds.split(',').forEach((id, index) => {
      manager.setWallpaper(id, WALLPAPERS[index % WALLPAPERS.length] as Wallpaper);
    });
  }, [manager, desktopIds]);
}

function WallpaperShell(): ReactElement {
  useWallpapers();
  return <WindowManagerShell className="h-full" />;
}

// ---------- snap layouts ----------

export const SnapLayoutsMenuOnMaximize: Story = () => (
  <DemoProvider options={{ windows: 2 }}>
    <Note>
      Hover the maximize button of a window (or press and hold it on a touch screen) to open the
      snap layouts. Pick a zone to snap the window there. Drag a window near another one or near an
      edge: its edges stick.
    </Note>
    <Frame>
      <Desktop />
    </Frame>
  </DemoProvider>
);

export const SnapLayoutsMenuMacControls: Story = () => (
  <DemoProvider options={{ windows: 2, shell: { controlsStyle: 'mac' } }}>
    <Note>The same menu opens from the green button.</Note>
    <Frame>
      <Desktop />
    </Frame>
  </DemoProvider>
);

// ---------- desktop overview ----------

export const DesktopOverviewOpen: Story = () => (
  <DemoProvider options={{ windows: 6, desktops: 3 }}>
    <Note>
      Every desktop with a frame for each window. Click a desktop or a window to go there, drag a
      window onto another desktop to move it (or focus it and press Shift+Arrow Left or Right). Esc
      closes it.
    </Note>
    <Frame>
      <SpreadShell open />
    </Frame>
  </DemoProvider>
);

export const DesktopOverviewShortcut: Story = () => (
  <DemoProvider options={{ windows: 4, desktops: 2 }}>
    <Note>Press Ctrl+Alt+O, or open it from the desktop switcher or the desktop menu.</Note>
    <Frame>
      <SpreadShell />
    </Frame>
  </DemoProvider>
);

// ---------- wallpapers ----------

export const WallpaperPickerPanel: Story = () => (
  <DemoProvider options={{ windows: 0 }}>
    <Note>
      The picker in place: theme background, colors and gradients from the theme tokens, or an image
      URL. A choice applies at once.
    </Note>
    <div className="max-w-md rounded-lg border border-border bg-card p-4 text-card-foreground">
      <WallpaperPicker />
    </div>
  </DemoProvider>
);

export const WallpaperPickerWithUpload: Story = () => (
  <DemoProvider options={{ windows: 0 }}>
    <Note>
      With an upload handler the Image tab has an upload button (here the file stays in memory).
    </Note>
    <div className="max-w-md rounded-lg border border-border bg-card p-4 text-card-foreground">
      <WallpaperPicker onUpload={(file) => URL.createObjectURL(file)} />
    </div>
  </DemoProvider>
);

export const WallpaperPickerDialogFromMenu: Story = () => (
  <DemoProvider options={{ windows: 1 }}>
    <Note>Right-click the desktop and choose Change wallpaper…</Note>
    <Frame>
      <WindowManagerShell
        className="h-full"
        desktop={{ onWallpaperUpload: (file) => URL.createObjectURL(file) }}
      />
    </Frame>
  </DemoProvider>
);

export const WallpapersPerDesktop: Story = () => (
  <DemoProvider options={{ windows: 2, desktops: 3 }}>
    <Note>Each desktop has its own wallpaper. Switch desktops from the taskbar.</Note>
    <Frame>
      <WallpaperShell />
    </Frame>
  </DemoProvider>
);
