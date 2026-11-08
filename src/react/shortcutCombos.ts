/** The things a keyboard shortcut can do. */
export type ShortcutAction =
  | 'cycleWindows'
  | 'cycleWindowsBack'
  | 'closeWindow'
  | 'minimizeWindow'
  | 'toggleMaximize'
  | 'snapLeft'
  | 'snapRight'
  | 'toggleFullscreen'
  | 'toggleAlwaysOnTop'
  | 'showDesktop'
  | 'desktopOverview'
  | 'switchDesktop'
  | 'startMenu'
  | 'leaveFullscreen';

/** Per shortcut: a combo such as `"Ctrl+Alt+W"` to change it, or `false` to turn it off. */
export type ShortcutOptions = Partial<Record<ShortcutAction, string | false>>;

/** The shortcuts in use after applying `ShortcutOptions` (turned-off ones are missing). */
export type ResolvedShortcuts = Partial<Record<ShortcutAction, string>>;

/**
 * The default shortcuts. `switchDesktop` is only the modifiers: they are combined with the
 * digits 1 to 9 (desktop 1 to 9).
 */
export const DEFAULT_SHORTCUTS: Readonly<Record<ShortcutAction, string>> = {
  cycleWindows: 'Ctrl+`',
  cycleWindowsBack: 'Ctrl+Shift+`',
  closeWindow: 'Ctrl+Alt+W',
  minimizeWindow: 'Ctrl+Alt+M',
  toggleMaximize: 'Ctrl+Alt+ArrowUp',
  snapLeft: 'Ctrl+Alt+ArrowLeft',
  snapRight: 'Ctrl+Alt+ArrowRight',
  toggleFullscreen: 'Ctrl+Alt+F',
  toggleAlwaysOnTop: 'Ctrl+Alt+T',
  showDesktop: 'Ctrl+Alt+D',
  desktopOverview: 'Ctrl+Alt+O',
  switchDesktop: 'Ctrl+Alt',
  startMenu: 'Ctrl+Alt+Space',
  leaveFullscreen: 'Escape',
};

/** Applies `options` to the defaults. */
export function resolveShortcuts(options?: ShortcutOptions): ResolvedShortcuts {
  const resolved: ResolvedShortcuts = {};
  for (const action of Object.keys(DEFAULT_SHORTCUTS) as ShortcutAction[]) {
    const choice = options?.[action];
    if (choice === false) continue;
    resolved[action] = choice ?? DEFAULT_SHORTCUTS[action];
  }
  return resolved;
}

/** A combo split into its modifiers and its key (null for a modifiers-only combo). */
export interface ParsedCombo {
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  /** Lower case, with aliases resolved (`'space'` is `' '`). */
  key: string | null;
}

const KEY_ALIASES: Record<string, string> = {
  space: ' ',
  esc: 'escape',
  up: 'arrowup',
  down: 'arrowdown',
  left: 'arrowleft',
  right: 'arrowright',
  cmd: 'meta',
  command: 'meta',
  control: 'ctrl',
  option: 'alt',
};

/** Parses `"Ctrl+Alt+W"`. Modifiers: Ctrl, Alt, Shift, Meta (Cmd). The key is the last part. */
export function parseCombo(combo: string): ParsedCombo {
  const parsed: ParsedCombo = { ctrl: false, alt: false, shift: false, meta: false, key: null };
  const parts = combo.split('+').map((part) => part.trim());
  // A trailing "+" is the plus key itself ("Ctrl++" splits into "Ctrl", "", "").
  for (let i = 0; i < parts.length; i += 1) {
    const raw = parts[i] ?? '';
    const part = raw === '' && i === parts.length - 1 && i > 0 ? '+' : raw;
    if (part === '') continue;
    const lower = part.toLowerCase();
    const name = KEY_ALIASES[lower] ?? lower;
    if (name === 'ctrl' || name === 'alt' || name === 'shift' || name === 'meta') {
      parsed[name] = true;
    } else {
      parsed.key = name;
    }
  }
  return parsed;
}

/** The `event.code` a key token usually has, so shortcuts survive layouts and Option on Mac. */
function codeFor(key: string): string | null {
  if (/^[a-z]$/.test(key)) return `key${key}`;
  if (/^[0-9]$/.test(key)) return `digit${key}`;
  if (key === '`') return 'backquote';
  if (key === ' ') return 'space';
  return null;
}

/** True when `event` is the key of `combo` (modifiers are not checked here). */
function keyMatches(key: string, event: KeyboardEvent): boolean {
  if (event.key.toLowerCase() === key) return true;
  const code = codeFor(key);
  return code !== null && event.code.toLowerCase() === code;
}

/** True when the modifiers held down are exactly those of `combo`. */
export function modifiersMatch(combo: ParsedCombo, event: KeyboardEvent): boolean {
  return (
    combo.ctrl === event.ctrlKey &&
    combo.alt === event.altKey &&
    combo.shift === event.shiftKey &&
    combo.meta === event.metaKey
  );
}

/** True when `event` is exactly `combo`. A modifiers-only combo never matches. */
export function matchesCombo(combo: ParsedCombo, event: KeyboardEvent): boolean {
  return combo.key !== null && modifiersMatch(combo, event) && keyMatches(combo.key, event);
}

/** The window number (1 to 9) of a digit key press, or null. */
export function digitOf(event: KeyboardEvent): number | null {
  const fromCode = /^Digit([1-9])$/.exec(event.code)?.[1];
  const fromKey = /^[1-9]$/.test(event.key) ? event.key : undefined;
  const digit = fromCode ?? fromKey;
  return digit === undefined ? null : Number(digit);
}

/** The `event.key` names of the modifiers of `combo` (what to watch for being released). */
export function modifierKeys(combo: ParsedCombo): string[] {
  const keys: string[] = [];
  if (combo.ctrl) keys.push('Control');
  if (combo.alt) keys.push('Alt');
  if (combo.meta) keys.push('Meta');
  if (keys.length === 0 && combo.shift) keys.push('Shift');
  return keys;
}
