# @integr8-media/window-manager

A full mini desktop for any React app: floating windows (drag, resize, minimize, maximize,
fullscreen, always on top, child and modal windows), snapping, multiple desktops, desktop icons, a
taskbar, a start menu, switchers, menus, messaging between windows, deep links and saved layouts.
Built on [`@integr8-media/ui`](https://github.com/MinaLouisLeon/integr8-ui).

> **Status: work in progress.** The repo scaffold is in place; the window manager itself is built
> milestone by milestone. Nothing here is released yet.

## Three ways to use it

**1. npm, app without Tailwind**

```tsx
import '@integr8-media/ui/fonts.css';
import '@integr8-media/ui/styles.css'; // ui tokens and component classes
import '@integr8-media/window-manager/styles.css'; // window-manager classes only (no tokens)
```

**2. npm, Tailwind v4 app**

```css
@import "tailwindcss";
@import "@integr8-media/ui/theme.css";
@import "@integr8-media/window-manager/theme.css";
@import "@integr8-media/ui/fonts.css";
```

**3. shadcn registry** (single items, no npm package needed)

```json
{
  "registries": {
    "@integr8": "https://minalouisleon.github.io/integr8-ui/r/{name}.json",
    "@integr8-wm": "https://minalouisleon.github.io/integr8-window-manager/r/{name}.json"
  }
}
```

```sh
npx shadcn@latest add @integr8/theme                     # once per project (ui tokens)
npx shadcn@latest add @integr8-wm/window-manager-shell   # the whole desktop, or single items
```

## Entries

| Import path | What it is |
| --- | --- |
| `@integr8-media/window-manager/core` | Framework-free core: no React, no DOM, no ui |
| `@integr8-media/window-manager` | `WindowManagerProvider`, hooks and components |
| `@integr8-media/window-manager/styles.css` | Prebuilt CSS for apps without Tailwind |
| `@integr8-media/window-manager/theme.css` | Tailwind v4 preset |

## Development

```sh
npm install
npm run lint && npm run typecheck && npm run test:coverage && npm run build
npm run playground   # Ladle, with the five ui themes in its toolbar
```

The spec lives in `docs/SPEC.md`. The README gains theming, persistence, keyboard shortcuts and
the API reference (TypeDoc) with the 1.0.0 release milestone.

## License

MIT
