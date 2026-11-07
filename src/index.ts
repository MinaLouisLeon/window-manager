/**
 * React entry of `@integr8-media/window-manager`: `WindowManagerProvider`, every hook and every
 * component, plus the core types. The public API is added milestone by milestone (M6 to M10).
 */
export type * from './core/types';
export type { MenuItemModel } from './react/menuModel';
export type { FrameControlProps, FrameProps } from './react/propHelpers';
export type {
  ResolvedShortcuts,
  ShortcutAction,
  ShortcutOptions,
} from './react/shortcutCombos';
export { DEFAULT_SHORTCUTS } from './react/shortcutCombos';
export type { SnapPreviewState } from './react/uiStores';
export type { MessageTarget, UseAppWindowResult } from './react/useAppWindow';
export { useAppWindow } from './react/useAppWindow';
export type { DesktopIconItem, UseDesktopIconsResult } from './react/useDesktopIcons';
export { useDesktopIcons } from './react/useDesktopIcons';
export type { UseDesktopMenuResult } from './react/useDesktopMenu';
export { useDesktopMenu, useRegisterDesktopMenuItems } from './react/useDesktopMenu';
export type { UseDesktopSurfaceOptions, UseDesktopSurfaceResult } from './react/useDesktopSurface';
export { useDesktopSurface } from './react/useDesktopSurface';
export type { DesktopSwitcherEntry, UseDesktopSwitcherResult } from './react/useDesktopSwitcher';
export { useDesktopSwitcher } from './react/useDesktopSwitcher';
export { useShortcuts } from './react/useShortcuts';
export { useSnapPreview } from './react/useSnapPreview';
export type {
  StartMenuCategory,
  StartMenuEntry,
  UseStartMenuResult,
} from './react/useStartMenu';
export { useStartMenu } from './react/useStartMenu';
export type { TaskbarItem, TaskbarWindow, UseTaskbarResult } from './react/useTaskbar';
export { useTaskbar } from './react/useTaskbar';
export type { UseDesktopsResult, UseWindowResult, WindowActions } from './react/useWindow';
export { useDesktops, useWindow } from './react/useWindow';
export type {
  ResizeEdge,
  UseWindowFrameResult,
  WindowControl,
} from './react/useWindowFrame';
export { useWindowFrame } from './react/useWindowFrame';
export type { UseWindowManagerResult } from './react/useWindowManager';
export { useWindowManager } from './react/useWindowManager';
export type { UseWindowMenuOptions, UseWindowMenuResult } from './react/useWindowMenu';
export { SNAP_ZONE_LABELS, useRegisterWindowMenuItems, useWindowMenu } from './react/useWindowMenu';
export type { SwitcherWindow, UseWindowSwitcherResult } from './react/useWindowSwitcher';
export { useWindowSwitcher } from './react/useWindowSwitcher';
export type { WindowManagerProviderProps } from './react/WindowManagerProvider';
export { AppWindowContent, WindowManagerProvider } from './react/WindowManagerProvider';
export type { AppWindowProps, IconComponent } from './react/windowManagerContext';
