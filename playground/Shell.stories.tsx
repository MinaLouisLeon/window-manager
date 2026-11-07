import type { Story } from '@ladle/react';
import type { ReactElement } from 'react';
import type { ShellSettings } from '../src/core/types';
import { WindowManagerShell } from '../src/index';
import { type DemoOptions, DemoProvider, Frame } from './demo';

function ShellStory({ options }: { options?: DemoOptions }): ReactElement {
  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">
        Drag, resize and snap windows (edges, corners, top edge to maximize). Right-click the
        desktop or a title bar. Ctrl+` cycles windows, Ctrl+Alt+Space opens the start menu. Works
        with mouse, touch and keyboard.
      </p>
      <Frame>
        <DemoProvider {...(options === undefined ? {} : { options })}>
          <WindowManagerShell className="h-full" />
        </DemoProvider>
      </Frame>
    </>
  );
}

const shell = (settings: Partial<ShellSettings>): DemoOptions => ({ shell: settings });

export const Default: Story = () => <ShellStory />;

export const ThirtyWindows: Story = () => <ShellStory options={{ windows: 30 }} />;

export const MacControls: Story = () => <ShellStory options={shell({ controlsStyle: 'mac' })} />;

export const TaskbarTop: Story = () => <ShellStory options={shell({ taskbarPosition: 'top' })} />;

export const TaskbarLeft: Story = () => <ShellStory options={shell({ taskbarPosition: 'left' })} />;

export const TaskbarRight: Story = () => (
  <ShellStory options={shell({ taskbarPosition: 'right' })} />
);

export const TaskbarAutoHide: Story = () => (
  <ShellStory options={shell({ taskbarAutoHide: true })} />
);

export const ThreeDesktops: Story = () => <ShellStory options={{ desktops: 3, windows: 2 }} />;

export const NoWindows: Story = () => <ShellStory options={{ windows: 0 }} />;
