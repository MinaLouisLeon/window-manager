import { describe, expect, it } from 'vitest';

const sources = import.meta.glob('./*.ts', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

describe('core is framework-free', () => {
  const files = Object.entries(sources).filter(([name]) => !name.endsWith('.test.ts'));

  it('finds the core source files', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)('%s imports no React, DOM or ui package', (_name, source) => {
    const specifiers = [...source.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)].map(
      (match) => match[1] as string,
    );
    for (const specifier of specifiers) {
      expect(specifier).toMatch(/^\./);
    }
    expect(source).not.toMatch(
      /\b(?:document|localStorage|navigator)\.|typeof window\b|\bwindow\.(?:addEventListener|location|inner)/,
    );
  });
});
