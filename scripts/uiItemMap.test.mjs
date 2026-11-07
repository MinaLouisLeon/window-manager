import { describe, expect, it } from 'vitest';
import { aliasForFile, buildUiItemMap, exportedNames } from './uiItemMap.mjs';

describe('aliasForFile', () => {
  it('maps ui, lib and hook files to shadcn aliases', () => {
    expect(aliasForFile('ui/button.tsx')).toBe('@/components/ui/button');
    expect(aliasForFile('lib/utils.ts')).toBe('@/lib/utils');
    expect(aliasForFile('lib/theme/useTheme.ts')).toBe('@/lib/theme/useTheme');
    expect(aliasForFile('hooks/use-mobile.ts')).toBe('@/hooks/use-mobile');
  });
});

describe('exportedNames', () => {
  it('reads declarations of every kind', () => {
    const source = [
      'export function Button() {}',
      'export async function load() {}',
      'export const buttonVariants = 1;',
      'export class Thing {}',
      'export type ButtonProps = {};',
      'export interface Options {}',
      'export enum Mode {}',
    ].join('\n');
    expect(exportedNames(source)).toEqual([
      'Button',
      'load',
      'buttonVariants',
      'Thing',
      'ButtonProps',
      'Options',
      'Mode',
    ]);
  });

  it('reads export lists, aliases and re-exports', () => {
    const source =
      "export { a, b as c, type D };\nexport type { E } from './e';\nexport * from './f';";
    expect(exportedNames(source)).toEqual(['a', 'c', 'D', 'E']);
  });

  it('skips default exports and text inside comments', () => {
    const source = '/**\n * export function Fake() {}\n */\nexport default function Real() {}';
    expect(exportedNames(source)).toEqual([]);
  });
});

describe('buildUiItemMap', () => {
  const items = [
    {
      name: 'utils',
      files: [{ path: 'lib/utils.ts', content: 'export function cn() {}' }],
    },
    {
      name: 'button',
      files: [
        {
          path: 'ui/button.tsx',
          content: 'export function Button() {}\nexport type ButtonProps = {};',
        },
      ],
    },
    {
      name: 'theme',
      files: [
        { path: 'lib/theme/useTheme.ts', content: 'export function useTheme() {}' },
        { path: 'lib/theme/ThemeProvider.tsx', content: 'export function ThemeProvider() {}' },
      ],
    },
    { name: 'fonts' },
  ];

  it('maps each exported name to its item and import path', () => {
    const map = buildUiItemMap(items);
    expect(map.get('Button')).toEqual({ item: 'button', alias: '@/components/ui/button' });
    expect(map.get('ButtonProps')).toEqual({ item: 'button', alias: '@/components/ui/button' });
    expect(map.get('cn')).toEqual({ item: 'utils', alias: '@/lib/utils' });
    expect(map.get('useTheme')).toEqual({ item: 'theme', alias: '@/lib/theme/useTheme' });
    expect(map.get('ThemeProvider')).toEqual({
      item: 'theme',
      alias: '@/lib/theme/ThemeProvider',
    });
  });

  it('keeps the first item (by name) when two items export the same name', () => {
    const map = buildUiItemMap([
      { name: 'zeta', files: [{ path: 'ui/zeta.tsx', content: 'export const Same = 1;' }] },
      { name: 'alpha', files: [{ path: 'ui/alpha.tsx', content: 'export const Same = 1;' }] },
    ]);
    expect(map.get('Same')?.item).toBe('alpha');
  });

  it('returns an empty map for no items', () => {
    expect(buildUiItemMap([]).size).toBe(0);
  });
});
