/**
 * One entry of a menu model. Components turn the model into ui menu items; apps add their own
 * entries with `useRegisterWindowMenuItems` and `useRegisterDesktopMenuItems`.
 */
export type MenuItemModel =
  | {
      type: 'item';
      id: string;
      label: string;
      /** Shortcut text such as "Ctrl+Alt+M", for display. */
      shortcut?: string | undefined;
      disabled?: boolean | undefined;
      /** Set for checkbox and radio entries. */
      checked?: boolean | undefined;
      kind?: 'checkbox' | 'radio' | undefined;
      destructive?: boolean | undefined;
      onSelect: () => void;
    }
  | {
      type: 'submenu';
      id: string;
      label: string;
      disabled?: boolean | undefined;
      items: MenuItemModel[];
    }
  | { type: 'separator'; id: string };
