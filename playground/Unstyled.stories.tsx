import type { Story } from '@ladle/react';
import type { CSSProperties, ReactElement } from 'react';
import {
  AppWindowContent,
  useDesktopIcons,
  useDesktopSurface,
  useDesktops,
  useSnapPreview,
  useTaskbar,
  useWindowFrame,
} from '../src/index';
import { DemoProvider, Frame } from './demo';

// A desktop built on the hooks alone: no components from this package and none from ui. Only
// plain elements and a few inline styles, to show what the prop getters give you.

const EDGES = ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'] as const;

const box: CSSProperties = {
  border: '1px solid currentColor',
  background: 'Canvas',
  color: 'CanvasText',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

function PlainWindow({ id }: { id: string }): ReactElement | null {
  const frame = useWindowFrame(id);
  const win = frame.window;
  if (win === null) return null;
  return (
    <div {...frame.getRootProps({ style: { ...box, opacity: frame.focused ? 1 : 0.85 } })}>
      <div
        {...frame.getTitleBarProps({
          style: { display: 'flex', gap: 8, padding: 4, borderBottom: '1px solid currentColor' },
        })}
      >
        <strong id={frame.titleId} style={{ flex: 1 }}>
          {win.title}
        </strong>
        <button {...frame.getControlProps('minimize')}>_</button>
        <button {...frame.getControlProps('maximize')}>□</button>
        <button {...frame.getControlProps('close')}>×</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        <AppWindowContent windowId={id} />
      </div>
      {EDGES.map((edge) => (
        <div key={edge} {...frame.getResizeHandleProps(edge)} />
      ))}
    </div>
  );
}

function PlainSnapPreview(): ReactElement | null {
  const preview = useSnapPreview();
  if (preview === null) return null;
  const { x, y, width, height } = preview.bounds;
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width,
        height,
        border: '2px dashed currentColor',
        pointerEvents: 'none',
        zIndex: 99999,
      }}
    />
  );
}

function PlainIcons(): ReactElement {
  const { icons, getListProps } = useDesktopIcons();
  return (
    <div
      {...getListProps({
        style: { position: 'absolute', top: 8, left: 8, display: 'grid', gap: 8 },
      })}
    >
      {icons.map((icon) => (
        <div
          key={icon.appId}
          {...icon.getItemProps({
            style: {
              padding: 4,
              border: icon.active ? '1px solid currentColor' : '1px solid transparent',
            },
          })}
        >
          {icon.title}
        </div>
      ))}
    </div>
  );
}

function PlainTaskbar(): ReactElement {
  const taskbar = useTaskbar();
  const desktops = useDesktops();
  return (
    <div
      {...taskbar.getRootProps({
        style: {
          ...box,
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          flexDirection: 'row',
          gap: 4,
          padding: 4,
        },
      })}
    >
      <button {...taskbar.getStartButtonProps()}>Start</button>
      {taskbar.items.map((item) => (
        <button
          key={item.appId}
          {...taskbar.getItemProps(item.appId, {
            style: { fontWeight: item.focused ? 700 : 400, opacity: item.minimized ? 0.5 : 1 },
          })}
        >
          {item.title}
          {item.windows.length > 1 ? ` (${item.windows.length})` : ''}
        </button>
      ))}
      <span style={{ flex: 1 }} />
      {desktops.desktops.map((desktop) => (
        <button
          type="button"
          key={desktop.id}
          aria-pressed={desktop.id === desktops.activeDesktopId}
          onClick={() => desktops.switchTo(desktop.id)}
        >
          {desktop.name}
        </button>
      ))}
      <button
        type="button"
        aria-label="New desktop"
        onClick={() => desktops.switchTo(desktops.add())}
      >
        +
      </button>
    </div>
  );
}

function PlainDesktop(): ReactElement {
  const surface = useDesktopSurface();
  return (
    <div
      ref={surface.ref}
      style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: 'Canvas' }}
    >
      <PlainIcons />
      {surface.windows.map((win) => (
        <PlainWindow key={win.id} id={win.id} />
      ))}
      <PlainSnapPreview />
      <PlainTaskbar />
    </div>
  );
}

export const HooksOnly: Story = () => (
  <DemoProvider options={{ windows: 3 }}>
    <p className="mb-3 text-sm text-muted-foreground">
      Everything here comes from the hooks: drag, resize, snap, minimize, icons, taskbar and
      desktops. Any app can draw its own look the same way.
    </p>
    <Frame>
      <PlainDesktop />
    </Frame>
  </DemoProvider>
);
