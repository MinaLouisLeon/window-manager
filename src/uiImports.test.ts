import { describe, expect, it } from 'vitest';

// The package must use ui piece by piece, never the whole library: ui is a peer dependency, and
// the shadcn registry installs only the ui items whose names a file imports. That works only if
// every import is a named import from the package root.
const sources = import.meta.glob(['./components/*.tsx', './react/*.ts', './react/*.tsx'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

const files = Object.entries(sources).filter(([name]) => !name.includes('.test.'));
const UI = '@integr8-media/ui';

describe('ui is imported piece by piece', () => {
  it('finds the source files', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it.each(files)('%s imports ui by name from the package root', (_name, source) => {
    // Every mention of the package: a named import, or a type import of names.
    const mentions = [...source.matchAll(/from\s+['"](@integr8-media\/ui[^'"]*)['"]/g)].map(
      (match) => match[1] as string,
    );
    for (const specifier of mentions) {
      expect(specifier).toBe(UI);
    }
    expect(source).not.toMatch(/import\s+\*\s+as\s+\w+\s+from\s+['"]@integr8-media\/ui['"]/);
    expect(source).not.toMatch(
      /import\s+\w+\s*(?:,\s*\{[^}]*\})?\s+from\s+['"]@integr8-media\/ui['"]/,
    );
    expect(source).not.toMatch(/require\(\s*['"]@integr8-media\/ui/);
  });
});
