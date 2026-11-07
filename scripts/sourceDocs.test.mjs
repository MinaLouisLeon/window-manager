import { describe, expect, it } from 'vitest';
import { defaultFromDoc, extractDocs, parseDocComment } from './sourceDocs.mjs';

const buttonSource = [
  "import type { ComponentProps, JSX } from 'react';",
  '',
  '/** Visual style of a {@link Button}. */',
  "export type ButtonVariant = 'default' | 'outline';",
  '',
  '/** @internal Not part of the public API. */',
  'export function buttonStyles(): string {',
  "  return '';",
  '}',
  '',
  '/** Props for {@link Button}. */',
  "export type ButtonProps = ComponentProps<'button'> & {",
  "  /** Visual style. Default `'default'` (primary color). */",
  '  variant?: ButtonVariant | undefined;',
  '  /** Render the child element instead of a `<button>`. */',
  '  asChild?: boolean;',
  '  /** @internal */',
  '  secret?: string;',
  '};',
  '',
  '/**',
  ' * A button. Pill-shaped in the Integr8 theme.',
  ' *',
  ' * @example',
  ' * ```tsx',
  ' * <Button onClick={save}>Save</Button>',
  ' *   <Button variant="outline">Cancel</Button>',
  ' * ```',
  ' */',
  'export function Button({ className, asChild = false, ...props }: ButtonProps): JSX.Element {',
  '  return <button className={className} {...props} />;',
  '}',
].join('\n');

const themeSource = [
  '/** Codes carried by {@link ThemeError}. */',
  "export type ThemeErrorCode = 'UNKNOWN_THEME' | 'MISSING_PROVIDER';",
  '',
  '/** Thrown by the theme engine. */',
  'export class ThemeError extends Error {',
  '  /** Machine-readable reason. */',
  '  readonly code: ThemeErrorCode;',
  '  private hidden = 1;',
  '  /**',
  '   * @param code - Machine-readable reason for the error.',
  '   * @param message - Human-readable description.',
  '   */',
  '  constructor(code: ThemeErrorCode, message: string) {',
  '    super(message);',
  '    this.code = code;',
  '  }',
  '}',
  '',
  '/** What useTheme returns. */',
  'export interface ThemeContextValue {',
  '  /** What the user picked. */',
  '  theme: string;',
  '  /**',
  '   * Switches the theme.',
  '   *',
  '   * @throws {@link ThemeError} with code `UNKNOWN_THEME`.',
  '   */',
  '  setTheme(theme: string): void;',
  '}',
  '',
  '/**',
  ' * Reads the current theme.',
  ' *',
  ' * @throws {@link ThemeError} with code `MISSING_PROVIDER` outside a provider.',
  ' * @returns The theme state.',
  ' */',
  'export function useTheme(): ThemeContextValue {',
  '  return null as never;',
  '}',
  '',
  '/** Font stacks. */',
  "export const FONT_STACKS = { sans: 'Inter' };",
  '',
  'const notExported = 1;',
  'export default function Ignored() {}',
].join('\n');

describe('parseDocComment', () => {
  it('splits the summary from tags and keeps code fences intact', () => {
    const doc = parseDocComment(
      [
        '/**',
        ' * First line.',
        ' * Second line.',
        ' *',
        ' * @example',
        ' * ```ts',
        ' * // @ts-expect-error not a tag inside a fence',
        ' * run();',
        ' * ```',
        ' * @deprecated Use `other` instead.',
        ' */',
      ].join('\n'),
    );
    expect(doc.summary).toBe('First line.\nSecond line.');
    expect(doc.tags).toEqual([
      { tag: 'example', text: '```ts\n// @ts-expect-error not a tag inside a fence\nrun();\n```' },
      { tag: 'deprecated', text: 'Use `other` instead.' },
    ]);
  });

  it('reads one-line comments', () => {
    expect(parseDocComment('/** Props for {@link Button}. */')).toEqual({
      summary: 'Props for {@link Button}.',
      tags: [],
    });
  });
});

describe('defaultFromDoc', () => {
  it('reads @default tags and "Default `x`" phrases', () => {
    expect(defaultFromDoc({ summary: '', tags: [{ tag: 'default', text: '`10`' }] })).toBe('10');
    expect(defaultFromDoc({ summary: "Visual style. Default `'default'`.", tags: [] })).toBe(
      "'default'",
    );
    expect(defaultFromDoc({ summary: "Menu heading, default 'Theme'.", tags: [] })).toBe("'Theme'");
    expect(defaultFromDoc({ summary: 'Page size, default 10.', tags: [] })).toBe('10');
    expect(defaultFromDoc({ summary: 'No default here.', tags: [] })).toBeUndefined();
  });
});

describe('extractDocs: a component file', () => {
  const docs = extractDocs('ui/button.tsx', buttonSource);
  const byName = Object.fromEntries(docs.map((doc) => [doc.name, doc]));

  it('lists exported declarations in source order, without @internal ones', () => {
    expect(docs.map((doc) => doc.name)).toEqual(['ButtonVariant', 'ButtonProps', 'Button']);
  });

  it('documents a component with its props parameter and examples', () => {
    const button = byName.Button;
    expect(button.kind).toBe('component');
    expect(button.summary).toBe('A button. Pill-shaped in the Integr8 theme.');
    expect(button.signature).toBe('Button(props: ButtonProps): JSX.Element');
    expect(button.params).toEqual([
      {
        name: 'props',
        type: 'ButtonProps',
        optional: false,
        defaultValue: undefined,
        description: '',
      },
    ]);
    expect(button.examples).toEqual([
      '```tsx\n<Button onClick={save}>Save</Button>\n  <Button variant="outline">Cancel</Button>\n```',
    ]);
  });

  it('lists the props of an intersection type, with defaults from docs and destructuring', () => {
    const props = byName.ButtonProps;
    expect(props.kind).toBe('type');
    expect(props.signature).toBe("type ButtonProps = ComponentProps<'button'> & { … }");
    expect(props.extends).toEqual(["ComponentProps<'button'>"]);
    expect(props.members).toEqual([
      {
        name: 'variant',
        type: 'ButtonVariant | undefined',
        optional: true,
        defaultValue: "'default'",
        description: "Visual style. Default `'default'` (primary color).",
      },
      {
        name: 'asChild',
        type: 'boolean',
        optional: true,
        defaultValue: 'false',
        description: 'Render the child element instead of a `<button>`.',
      },
    ]);
  });

  it('shows union types in the signature', () => {
    expect(byName.ButtonVariant.signature).toBe("type ButtonVariant = 'default' | 'outline'");
  });
});

describe('extractDocs: classes, interfaces, hooks and constants', () => {
  const docs = extractDocs('lib/theme/theme.ts', themeSource);
  const byName = Object.fromEntries(docs.map((doc) => [doc.name, doc]));

  it('skips non-exported and default exports', () => {
    expect(docs.map((doc) => doc.name)).toEqual([
      'ThemeErrorCode',
      'ThemeError',
      'ThemeContextValue',
      'useTheme',
      'FONT_STACKS',
    ]);
  });

  it('documents a class with public properties and constructor parameters', () => {
    const error = byName.ThemeError;
    expect(error.kind).toBe('class');
    expect(error.signature).toBe('class ThemeError extends Error');
    expect(error.members).toEqual([
      {
        name: 'readonly code',
        type: 'ThemeErrorCode',
        optional: false,
        description: 'Machine-readable reason.',
      },
    ]);
    expect(error.params.map((param) => [param.name, param.description])).toEqual([
      ['code', 'Machine-readable reason for the error.'],
      ['message', 'Human-readable description.'],
    ]);
  });

  it('documents interface methods', () => {
    const members = byName.ThemeContextValue.members;
    expect(members.map((member) => [member.name, member.type])).toEqual([
      ['theme', 'string'],
      ['setTheme', '(theme: string) => void'],
    ]);
  });

  it('documents a hook with throws and returns', () => {
    const hook = byName.useTheme;
    expect(hook.kind).toBe('hook');
    expect(hook.signature).toBe('useTheme(): ThemeContextValue');
    expect(hook.throws).toEqual([
      '{@link ThemeError} with code `MISSING_PROVIDER` outside a provider.',
    ]);
    expect(hook.returnsDescription).toBe('The theme state.');
  });

  it('shows short constant values', () => {
    expect(byName.FONT_STACKS.kind).toBe('constant');
    expect(byName.FONT_STACKS.signature).toBe("const FONT_STACKS = { sans: 'Inter' }");
  });
});
