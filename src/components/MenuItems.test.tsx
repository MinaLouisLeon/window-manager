import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@integr8-media/ui';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MenuItemModel } from '../react/menuModel';
import { MenuItems } from './MenuItems';

function renderMenu(items: MenuItemModel[]): void {
  render(
    <DropdownMenu open>
      <DropdownMenuTrigger>Menu</DropdownMenuTrigger>
      <DropdownMenuContent>
        <MenuItems items={items} variant="dropdown" />
      </DropdownMenuContent>
    </DropdownMenu>,
  );
}

const onSelect = vi.fn();

describe('MenuItems: unchecked placeholder', () => {
  it('shows a placeholder in the gutter of an unchecked checkbox entry only', () => {
    renderMenu([
      { type: 'item', id: 'off', label: 'Off', kind: 'checkbox', checked: false, onSelect },
      { type: 'item', id: 'on', label: 'On', kind: 'checkbox', checked: true, onSelect },
    ]);
    const off = screen.getByRole('menuitemcheckbox', { name: 'Off' });
    const on = screen.getByRole('menuitemcheckbox', { name: 'On' });
    expect(off.querySelector('[data-wm-unchecked]')).not.toBeNull();
    expect(on.querySelector('[data-wm-unchecked]')).toBeNull();
  });

  it('treats a checkbox entry without a checked value as unchecked', () => {
    renderMenu([{ type: 'item', id: 'plain', label: 'Plain', kind: 'checkbox', onSelect }]);
    const item = screen.getByRole('menuitemcheckbox', { name: 'Plain' });
    expect(item.querySelector('[data-wm-unchecked]')).not.toBeNull();
  });

  it('shows a placeholder for every radio entry that is not the checked one', () => {
    renderMenu([
      { type: 'item', id: 'a', label: 'A', kind: 'radio', checked: false, onSelect },
      { type: 'item', id: 'b', label: 'B', kind: 'radio', checked: true, onSelect },
      { type: 'item', id: 'c', label: 'C', kind: 'radio', checked: false, onSelect },
    ]);
    const withPlaceholder = screen
      .getAllByRole('menuitemradio')
      .filter((item) => item.querySelector('[data-wm-unchecked]') !== null)
      .map((item) => item.textContent);
    expect(withPlaceholder).toEqual(['A', 'C']);
  });

  it('keeps the placeholder out of the accessible name and the accessibility tree', () => {
    renderMenu([
      { type: 'item', id: 'off', label: 'Off', kind: 'checkbox', checked: false, onSelect },
    ]);
    const item = screen.getByRole('menuitemcheckbox', { name: 'Off' });
    expect(item.querySelector('[data-wm-unchecked]')?.getAttribute('aria-hidden')).toBe('true');
    expect(item.getAttribute('aria-checked')).toBe('false');
  });

  it('adds nothing to plain entries', () => {
    renderMenu([{ type: 'item', id: 'plain', label: 'Plain', onSelect }]);
    expect(document.querySelector('[data-wm-unchecked]')).toBeNull();
  });
});
