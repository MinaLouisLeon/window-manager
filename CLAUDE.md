# CLAUDE.md — integr8-window-manager

This repo is `@integr8-media/window-manager`: a full mini desktop for any React app (floating windows with drag, resize, snapping and fullscreen; multiple desktops; desktop icons; a taskbar with a notification area; start menu, switchers and menus; saved layouts). It ships two ways, like `@integr8-media/ui`: the whole package from npm, or single items with `npx shadcn add` from its own registry, generated from the same source. It is build step 3 of the Integr8 Workbench project, in a fresh repo. Tooling comes from `@integr8-media/config` (published, ^1.1.0). Every visual building block (button, menu, popover, dialog, tooltip, calendar, …) comes from `@integr8-media/ui` (published, ^1.2.1).

**The source of truth for what to build is `docs/SPEC.md`.** If something is unclear or the spec seems wrong, stop and ask; do not guess or change the public API.

**Do not read spec files unless the developer explicitly tells you to in that session.** This covers `docs/SPEC.md` and every feature spec split out of it later. A link from one spec to another, or a task that touches a spec's area, is not permission to open it; ask the developer instead. When told to read a spec, read it fully.

## Rules for Claude Code

- **Never run commands.** No tests, typecheck, lint, build, install, Ladle, Playwright, size-limit or git push. The developer runs every command. (Lefthook's quick pre-commit Biome check runs automatically when you commit; that is fine.)
- Write tests and Ladle stories for every feature, but do not run them.
- Commit only on a `feature/*` branch created from `dev`. Never commit to `main` or `dev`.
- **Ask first** before:
  - adding or upgrading **any** library or dependency (runtime, peer or dev) that is not in the spec's approved list. Give name, version, reason, approximate size and license, and wait. The developer approves or denies each one. Only after approval add it to package.json and let the developer run the install. If denied, find another way or ask how to proceed;
  - starting a sub-agent (Task/Agent tool). Say what the sub-agent would do and wait: the developer picks the model it runs on, or denies it and the work is done in the main session;
  - changing the public API defined in docs/SPEC.md (exports, types, props, registry item names, CSS variables, data attributes, shortcuts);
  - pushing a branch or opening a pull request.
- **Never duplicate @integr8-media/ui.** Before building any visual piece (button, menu, popover, dialog, tooltip, command list, shortcut label, toolbar, calendar, scroll area, …), use what `@integr8-media/ui` exports. If ui is missing something you need, stop and ask instead of writing your own version.
- `src/core/` never imports React, `@integr8-media/ui` or touches the DOM; it is plain TypeScript, fully unit-testable.
- **Keep progress in docs/SPEC.md.** The spec is locked except its "Progress" section. After finishing each task, update that section in the same commit: status, branch name, a one-line note, and what is still not implemented. This lets the developer track work across several branches. (Updating Progress is the one case where you may open SPEC.md without being told, and only that section.)
- **Never**: push to main or dev, bump versions, create tags, publish to npm, or add an npm token.
- When you finish a task, reply with: files created or changed, what is left, and the exact commands the developer should run to check the work.
- Work in the order of the milestones in the spec (M0 scaffold, then core, then hooks, then components), one milestone per branch.

## Code conventions

- Node 24 LTS, React 19, TypeScript strict (via `@integr8-media/config/tsconfig/react-library.json`, which turns on `isolatedDeclarations`: give every exported function an explicit return type), ES modules only.
- Package manager: **npm** (package-lock.json), like integr8-ui.
- Layout: `src/core/` (framework-free), `src/react/` (provider and hooks), `src/components/` (visual components), `src/styles/` (CSS entries); `src/core/index.ts` and `src/index.ts` export the public API only; tests next to the code (`snapZones.test.ts` beside `snapZones.ts`); Ladle stories in `playground/`; registry generator in `scripts/` and `registry/`; `docs/` for SPEC.md and guides.
- Imports from ui always use the package name (`import { Button } from '@integr8-media/ui'`), never deep paths; the registry generator rewrites them.
- Published files: `"files": ["dist"]` only. No source maps that contain source.
- File names: camelCase for non-components (`createWindowManager.ts`, `snapZones.ts`, `useWindowFrame.ts`); PascalCase for React component files (`Window.tsx`, `Taskbar.tsx`). One component (plus its parts) per file, so each file can become one registry item.
- Named exports only; no default exports (except `*.config.ts` files that require them).
- Components: headless logic in hooks; components accept `className` and `style`, forward refs, merge classes with `cn()` from ui, expose state through the `data-*` attributes in the spec, respect `prefers-reduced-motion`.
- Styling only through the ui theme tokens and the `--wm-*` size variables in the spec; never hard-code colors.
- Dragging and resizing use Pointer Events with pointer capture; during a drag update `transform` directly and commit to the store on pointer up (no React render per pointer move).
- Errors: export typed error classes with codes (`WindowManagerError` with `UNKNOWN_APP`, …); never throw plain strings.
- TSDoc comments on every public export (the registry site reads them).
- Formatting (Biome preset): 2-space indent, line width 100, single quotes in TS, double quotes in JSX, semicolons always, trailing commas everywhere.

## Docs in this repo

- `README.md`: what it is, the three ways to use it (npm + styles.css, npm + theme.css in a Tailwind app, shadcn registry), quick example, core vs React entries, theming with @integr8-media/ui, persistence adapters, keyboard shortcuts, non-goals.
- `docs/SPEC.md`: the locked spec (do not edit without approval), except the "Progress" section.
- API reference generated from TSDoc with TypeDoc.

## Git and versions

- Branches: `main` (released), `dev` (integration), `feature/<name>` from dev. Pull requests go into dev; dev is merged into main for a release.
- Versions are bumped by hand by the developer (0.x while building, 1.0.0 at milestone M12).
- First publish: the developer publishes once by hand from their machine, then adds a trusted publisher on npmjs.com (GitHub Actions, this repo, workflow `release.yml`).
- Release: merge dev into main, push a tag `vX.Y.Z`; `.github/workflows/release.yml` calls the shared `publish.yml` from integr8-config and publishes through npm trusted publishing (OIDC). No npm token exists in the repo or its secrets; never add one. Provenance only if this repo is public.
- Registry site: `.github/workflows/registry.yml` builds the registry JSON, the landing page and the Ladle playground and deploys them to GitHub Pages on every push to main.

## CI and hooks

- CI runs on pull requests into dev only (shared `pr-checks.yml` from integr8-config, `os-matrix: false`): lint, typecheck, tests with an 80% line-coverage floor, bundle size, export checks (publint, attw).
- Lefthook (extends `@integr8-media/config/lefthook/base.yml`): pre-commit = Biome on staged files; pre-push = typecheck, test:coverage, build. `playground:smoke` and `fixtures` are not hooks; the developer runs them by hand.
