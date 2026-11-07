import {
  ContextMenuCheckboxItem,
  ContextMenuItem,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  Shortcut,
} from '@integr8-media/ui';
import { Fragment, type ReactElement, type ReactNode } from 'react';
import type { MenuItemModel } from '../react/menuModel';

/** Which family of ui menu parts to draw the model with. */
export type MenuVariant = 'context' | 'dropdown';

/** Props of `MenuItems`. */
export interface MenuItemsProps {
  items: MenuItemModel[];
  variant: MenuVariant;
}

const KEY_NAMES: Record<string, string> = {
  arrowup: 'up',
  arrowdown: 'down',
  arrowleft: 'left',
  arrowright: 'right',
  escape: 'esc',
};

/** Turns a combo such as "Ctrl+Alt+ArrowUp" into the key names ui's `Shortcut` understands. */
function shortcutKeys(combo: string): string {
  return combo
    .split('+')
    .map((key) => KEY_NAMES[key.toLowerCase()] ?? key)
    .join('+');
}

interface Parts {
  Item: typeof ContextMenuItem;
  CheckboxItem: typeof ContextMenuCheckboxItem;
  RadioGroup: typeof ContextMenuRadioGroup;
  RadioItem: typeof ContextMenuRadioItem;
  Separator: typeof ContextMenuSeparator;
  Shortcut: typeof ContextMenuShortcut;
  Sub: typeof ContextMenuSub;
  SubTrigger: typeof ContextMenuSubTrigger;
  SubContent: typeof ContextMenuSubContent;
}

// The dropdown parts take the same props as the context menu ones.
const CONTEXT = {
  Item: ContextMenuItem,
  CheckboxItem: ContextMenuCheckboxItem,
  RadioGroup: ContextMenuRadioGroup,
  RadioItem: ContextMenuRadioItem,
  Separator: ContextMenuSeparator,
  Shortcut: ContextMenuShortcut,
  Sub: ContextMenuSub,
  SubTrigger: ContextMenuSubTrigger,
  SubContent: ContextMenuSubContent,
} satisfies Parts;
const DROPDOWN = {
  Item: DropdownMenuItem,
  CheckboxItem: DropdownMenuCheckboxItem,
  RadioGroup: DropdownMenuRadioGroup,
  RadioItem: DropdownMenuRadioItem,
  Separator: DropdownMenuSeparator,
  Shortcut: DropdownMenuShortcut,
  Sub: DropdownMenuSub,
  SubTrigger: DropdownMenuSubTrigger,
  SubContent: DropdownMenuSubContent,
} as unknown as Parts;

function renderItems(items: MenuItemModel[], parts: Parts): ReactNode[] {
  const nodes: ReactNode[] = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index] as MenuItemModel;
    if (item.type === 'separator') {
      nodes.push(<parts.Separator key={item.id} />);
    } else if (item.type === 'submenu') {
      nodes.push(
        <parts.Sub key={item.id}>
          <parts.SubTrigger disabled={item.disabled === true}>{item.label}</parts.SubTrigger>
          <parts.SubContent>{renderItems(item.items, parts)}</parts.SubContent>
        </parts.Sub>,
      );
    } else if (item.kind === 'radio') {
      // A run of radio entries is one group; its value is the checked entry.
      const group: Extract<MenuItemModel, { type: 'item' }>[] = [item];
      while (true) {
        const next = items[index + 1];
        if (next?.type !== 'item' || next.kind !== 'radio') break;
        group.push(next);
        index += 1;
      }
      const checked = group.find((entry) => entry.checked === true);
      nodes.push(
        <parts.RadioGroup key={group[0]?.id} value={checked?.id ?? ''}>
          {group.map((entry) => (
            <parts.RadioItem
              key={entry.id}
              value={entry.id}
              disabled={entry.disabled === true}
              onSelect={entry.onSelect}
            >
              {entry.label}
              <Hint shortcut={entry.shortcut} parts={parts} />
            </parts.RadioItem>
          ))}
        </parts.RadioGroup>,
      );
    } else if (item.kind === 'checkbox') {
      nodes.push(
        <parts.CheckboxItem
          key={item.id}
          checked={item.checked === true}
          disabled={item.disabled === true}
          onSelect={item.onSelect}
        >
          {item.label}
          <Hint shortcut={item.shortcut} parts={parts} />
        </parts.CheckboxItem>,
      );
    } else {
      nodes.push(
        <parts.Item
          key={item.id}
          disabled={item.disabled === true}
          variant={item.destructive ? 'destructive' : 'default'}
          onSelect={item.onSelect}
        >
          {item.label}
          <Hint shortcut={item.shortcut} parts={parts} />
        </parts.Item>,
      );
    }
  }
  return nodes;
}

function Hint({
  shortcut,
  parts,
}: {
  shortcut: string | undefined;
  parts: Parts;
}): ReactElement | null {
  if (shortcut === undefined) return null;
  return (
    <parts.Shortcut>
      <Shortcut keys={shortcutKeys(shortcut)} variant="text" />
    </parts.Shortcut>
  );
}

/**
 * Draws a menu model (from `useWindowMenu` or `useDesktopMenu`) with ui's context menu or
 * dropdown menu parts: items, checkbox and radio entries, submenus, separators and shortcut
 * hints. Put it inside the menu's content element.
 */
export function MenuItems({ items, variant }: MenuItemsProps): ReactElement {
  return <Fragment>{renderItems(items, variant === 'context' ? CONTEXT : DROPDOWN)}</Fragment>;
}
