import { useMemo } from 'react';
import type { AppId } from '../core/types';
import { useExternalStore } from './externalStore';
import { launchApp } from './launchApp';
import { useWindowManagerContext } from './windowManagerContext';

/** One app in the start menu. */
export interface StartMenuEntry {
  appId: AppId;
  title: string;
  /** The app's `icon`, as given in its definition. */
  icon: unknown;
  category: string;
  keywords: string[];
}

/** Apps of one category, sorted by title. */
export interface StartMenuCategory {
  name: string;
  apps: StartMenuEntry[];
}

/** What `useStartMenu` returns. */
export interface UseStartMenuResult {
  open: boolean;
  setOpen(open: boolean): void;
  toggle(): void;
  search: string;
  setSearch(search: string): void;
  /** The apps that match the search, grouped by category (categories sorted by name). */
  categories: StartMenuCategory[];
  /** The same apps as one list, in the order of `categories`. */
  results: StartMenuEntry[];
  /** Opens the app (or focuses its window), then closes the menu and clears the search. */
  launch(appId: AppId): void;
}

const DEFAULT_CATEGORY = 'Apps';

/**
 * The start menu: open state, search text, and the apps to show. It lists the apps that have a
 * component in the provider's `apps` and are not hidden with `placement.startMenu: false`.
 * The search matches every typed word against title, category and keywords.
 */
export function useStartMenu(): UseStartMenuResult {
  const { manager, apps, stores } = useWindowManagerContext();
  const { open, search } = useExternalStore(stores.startMenu);

  const entries = useMemo((): StartMenuEntry[] => {
    const list: StartMenuEntry[] = [];
    for (const appId of Object.keys(apps)) {
      let app: ReturnType<typeof manager.getApp>;
      try {
        app = manager.getApp(appId);
      } catch {
        continue; // a component for an app that has no definition
      }
      const placement = app.placement?.startMenu;
      if (placement === false) continue;
      const details = typeof placement === 'object' ? placement : {};
      list.push({
        appId,
        title: app.title,
        icon: app.icon,
        category: details.category ?? DEFAULT_CATEGORY,
        keywords: details.keywords ?? [],
      });
    }
    return list;
  }, [apps, manager]);

  const categories = useMemo((): StartMenuCategory[] => {
    const words = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matching = entries.filter((entry) => {
      const haystack = [entry.title, entry.category, ...entry.keywords].join(' ').toLowerCase();
      return words.every((word) => haystack.includes(word));
    });
    const groups = new Map<string, StartMenuEntry[]>();
    for (const entry of matching) {
      groups.set(entry.category, [...(groups.get(entry.category) ?? []), entry]);
    }
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, list]) => ({
        name,
        apps: [...list].sort((a, b) => a.title.localeCompare(b.title)),
      }));
  }, [entries, search]);

  const results = useMemo(() => categories.flatMap((category) => category.apps), [categories]);

  const actions = useMemo(
    () => ({
      setOpen: (next: boolean): void =>
        stores.startMenu.set((previous) => ({ open: next, search: next ? previous.search : '' })),
      toggle: (): void =>
        stores.startMenu.set((previous) => ({ open: !previous.open, search: '' })),
      setSearch: (next: string): void =>
        stores.startMenu.set((previous) => ({ ...previous, search: next })),
      launch: (appId: AppId): void => {
        launchApp(manager, appId);
        stores.startMenu.set({ open: false, search: '' });
      },
    }),
    [manager, stores],
  );

  return { open, search, categories, results, ...actions };
}
