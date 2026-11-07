/** @type {import('@ladle/react').UserConfig} */
export default {
  stories: 'playground/**/*.stories.tsx',
  // Adds the Tailwind v4 Vite plugin so the components' classes compile.
  viteConfig: `${process.cwd()}/playground/vite.config.ts`,
  // The themes come from our own toolbar (playground/components.tsx), not Ladle's addon.
  addons: {
    theme: { enabled: false },
  },
};
