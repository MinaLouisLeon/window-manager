// Copies the CSS presets into dist/ after tsdown has built the JavaScript.
//
// - dist/theme.css: the Tailwind v4 preset (its `@source` points at the built .mjs files).
// - dist/wm.css: the --wm-* size variables that theme.css imports.
//
// Usage: node scripts/buildAssets.mjs

import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const stylesDir = join(root, 'src', 'styles');
const distDir = join(root, 'dist');

await mkdir(distDir, { recursive: true });
for (const file of ['theme.css', 'wm.css']) {
  await copyFile(join(stylesDir, file), join(distDir, file));
  console.log(`dist/${file}`);
}
