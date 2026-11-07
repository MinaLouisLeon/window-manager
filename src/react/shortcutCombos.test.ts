import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SHORTCUTS,
  digitOf,
  matchesCombo,
  modifierKeys,
  modifiersMatch,
  parseCombo,
  resolveShortcuts,
} from './shortcutCombos';

function key(init: KeyboardEventInit): KeyboardEvent {
  return new KeyboardEvent('keydown', init);
}

describe('parseCombo', () => {
  it('splits modifiers and key', () => {
    expect(parseCombo('Ctrl+Alt+W')).toEqual({
      ctrl: true,
      alt: true,
      shift: false,
      meta: false,
      key: 'w',
    });
  });

  it('understands aliases and the backquote and plus keys', () => {
    expect(parseCombo('Ctrl+`').key).toBe('`');
    expect(parseCombo('Ctrl++').key).toBe('+');
    expect(parseCombo('Alt+Space').key).toBe(' ');
    expect(parseCombo('Cmd+Up')).toMatchObject({ meta: true, key: 'arrowup' });
    expect(parseCombo('Esc').key).toBe('escape');
  });

  it('has no key for a modifiers-only combo', () => {
    expect(parseCombo('Ctrl+Alt').key).toBeNull();
  });
});

describe('resolveShortcuts', () => {
  it('uses the defaults', () => {
    expect(resolveShortcuts()).toEqual(DEFAULT_SHORTCUTS);
  });

  it('overrides and disables single shortcuts', () => {
    const resolved = resolveShortcuts({ closeWindow: 'Ctrl+Alt+X', minimizeWindow: false });
    expect(resolved.closeWindow).toBe('Ctrl+Alt+X');
    expect(resolved.minimizeWindow).toBeUndefined();
    expect(resolved.showDesktop).toBe(DEFAULT_SHORTCUTS.showDesktop);
  });
});

describe('matchesCombo', () => {
  const combo = parseCombo('Ctrl+Alt+W');

  it('matches the exact modifiers and key', () => {
    expect(matchesCombo(combo, key({ key: 'w', code: 'KeyW', ctrlKey: true, altKey: true }))).toBe(
      true,
    );
  });

  it('matches by key code when Option changes the character', () => {
    expect(matchesCombo(combo, key({ key: '∑', code: 'KeyW', ctrlKey: true, altKey: true }))).toBe(
      true,
    );
  });

  it('rejects missing or extra modifiers and other keys', () => {
    expect(matchesCombo(combo, key({ key: 'w', code: 'KeyW', ctrlKey: true }))).toBe(false);
    expect(
      matchesCombo(
        combo,
        key({ key: 'w', code: 'KeyW', ctrlKey: true, altKey: true, shiftKey: true }),
      ),
    ).toBe(false);
    expect(matchesCombo(combo, key({ key: 'q', code: 'KeyQ', ctrlKey: true, altKey: true }))).toBe(
      false,
    );
  });

  it('tells Ctrl+` from Ctrl+Shift+`', () => {
    const plain = parseCombo('Ctrl+`');
    const shifted = parseCombo('Ctrl+Shift+`');
    const press = key({ key: '`', code: 'Backquote', ctrlKey: true });
    const pressShift = key({ key: '~', code: 'Backquote', ctrlKey: true, shiftKey: true });
    expect(matchesCombo(plain, press)).toBe(true);
    expect(matchesCombo(shifted, press)).toBe(false);
    expect(matchesCombo(shifted, pressShift)).toBe(true);
    expect(matchesCombo(plain, pressShift)).toBe(false);
  });

  it('matches Space and arrow keys', () => {
    expect(
      matchesCombo(
        parseCombo('Ctrl+Alt+Space'),
        key({ key: ' ', code: 'Space', ctrlKey: true, altKey: true }),
      ),
    ).toBe(true);
    expect(
      matchesCombo(
        parseCombo('Ctrl+Alt+ArrowUp'),
        key({ key: 'ArrowUp', code: 'ArrowUp', ctrlKey: true, altKey: true }),
      ),
    ).toBe(true);
  });

  it('never matches a modifiers-only combo', () => {
    expect(
      matchesCombo(parseCombo('Ctrl+Alt'), key({ key: 'a', ctrlKey: true, altKey: true })),
    ).toBe(false);
  });
});

describe('helpers', () => {
  it('checks modifiers alone', () => {
    expect(modifiersMatch(parseCombo('Ctrl+Alt'), key({ ctrlKey: true, altKey: true }))).toBe(true);
    expect(modifiersMatch(parseCombo('Ctrl+Alt'), key({ ctrlKey: true }))).toBe(false);
  });

  it('reads the digit 1 to 9 from code or key', () => {
    expect(digitOf(key({ key: '¡', code: 'Digit1' }))).toBe(1);
    expect(digitOf(key({ key: '9' }))).toBe(9);
    expect(digitOf(key({ key: '0', code: 'Digit0' }))).toBeNull();
    expect(digitOf(key({ key: 'a', code: 'KeyA' }))).toBeNull();
  });

  it('lists the modifier keys to watch for release', () => {
    expect(modifierKeys(parseCombo('Ctrl+`'))).toEqual(['Control']);
    expect(modifierKeys(parseCombo('Alt+Tab'))).toEqual(['Alt']);
    expect(modifierKeys(parseCombo('Shift+Tab'))).toEqual(['Shift']);
    expect(modifierKeys(parseCombo('Escape'))).toEqual([]);
  });
});
