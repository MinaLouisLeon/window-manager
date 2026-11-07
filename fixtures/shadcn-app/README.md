# shadcn-app fixture

A shadcn project (Vite, Tailwind v4) that gets the window manager from this repo's registry.
`npm run fixtures` (repo root) does the whole round trip:

1. builds the registry with `REGISTRY_BASE_URL=http://localhost:61300/r` and serves it locally,
2. runs `npx shadcn add @integr8/theme @integr8-wm/window-manager-shell` here (the ui items come
   from the published ui registry, so this step needs network access),
3. builds the app and checks it with `fixtures/fixtures.spec.ts`, like the two npm fixtures.

Files under `src/components/ui/`, `src/hooks/`, `src/lib/` and the token block in `src/index.css`
are written by shadcn and are not committed (see `.gitignore`).
