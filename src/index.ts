/**
 * React entry of `@integr8-media/window-manager`: `WindowManagerProvider`, every hook and every
 * component, plus the core types. The public API is added milestone by milestone (M6 to M10).
 */
export type { CloseGuardDialogProps } from './components/CloseGuardDialog';
export { CloseGuardDialog } from './components/CloseGuardDialog';
export type { DesktopProps } from './components/Desktop';
export { Desktop } from './components/Desktop';
export type { DesktopIconsProps } from './components/DesktopIcons';
export { DesktopIcons } from './components/DesktopIcons';
export type { DesktopMenuProps } from './components/DesktopMenu';
export { DesktopMenu } from './components/DesktopMenu';
export type { DesktopSwitcherProps } from './components/DesktopSwitcher';
export { DesktopSwitcher } from './components/DesktopSwitcher';
export type { SnapPreviewProps } from './components/SnapPreview';
export { SnapPreview } from './components/SnapPreview';
export type { StartMenuProps } from './components/StartMenu';
export { StartMenu } from './components/StartMenu';
export type { TaskbarProps } from './components/Taskbar';
export { Taskbar } from './components/Taskbar';
export type { WindowProps } from './components/Window';
export { Window } from './components/Window';
export type { WindowControlsProps } from './components/WindowControls';
export { WindowControls } from './components/WindowControls';
export type { WindowManagerShellProps } from './components/WindowManagerShell';
export { WindowManagerShell } from './components/WindowManagerShell';
export type { WindowMenuProps } from './components/WindowMenu';
export { WindowMenu } from './components/WindowMenu';
export type { WindowSwitcherProps } from './components/WindowSwitcher';
export { WindowSwitcher } from './components/WindowSwitcher';
export type { WindowTitleBarProps } from './components/WindowTitleBar';
export { WindowTitleBar } from './components/WindowTitleBar';
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
