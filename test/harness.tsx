import type { ComponentType, ReactElement, ReactNode } from 'react';
import { createWindowManager } from '../src/core/createWindowManager';
import type { AppDefinition, WindowManager } from '../src/core/types';
import type { ShortcutOptions } from '../src/react/shortcutCombos';
import { WindowManagerProvider } from '../src/react/WindowManagerProvider';
import type { AppWindowProps } from '../src/react/windowManagerContext';

export const testApps: AppDefinition[] = [
  { id: 'notes', title: 'Notes', size: { default: { width: 400, height: 300 } } },
  {
    id: 'fixed',
    title: 'Fixed',
    size: { resizable: false, default: { width: 300, height: 200 } },
  },
  { id: 'mac', title: 'Mac', controlsStyle: 'mac' },
];

/** A manager with the test apps and a 1000×700 viewport. */
export function createTestManager(): WindowManager {
  const manager = createWindowManager({ apps: testApps });
  manager.setViewport({ width: 1000, height: 700 });
  return manager;
}

/** A wrapper component that provides `manager` (and optional app components) to hooks. */
export function createWrapper(
  manager: WindowManager,
  appComponents: Record<string, ComponentType<AppWindowProps>> = {},
  shortcuts?: ShortcutOptions | false,
): ComponentType<{ children?: ReactNode }> {
  const apps = { notes: () => null, fixed: () => null, mac: () => null, ...appComponents };
  return ({ children }: { children?: ReactNode }): ReactElement => {
    return (
      <WindowManagerProvider
        manager={manager}
        apps={apps}
        {...(shortcuts === undefined ? {} : { shortcuts })}
      >
        {children}
      </WindowManagerProvider>
    );
  };
}
