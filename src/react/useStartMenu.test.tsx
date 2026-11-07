import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createWrapper } from '../../test/harness';
import { createWindowManager } from '../core/createWindowManager';
import type { AppDefinition } from '../core/types';
import { useStartMenu } from './useStartMenu';

const apps: AppDefinition[] = [
  {
    id: 'notes',
    title: 'Notes',
    placement: { startMenu: { category: 'Office', keywords: ['text', 'write'] } },
  },
  { id: 'calc', title: 'Calculator' },
  { id: 'hidden', title: 'Hidden', placement: { startMenu: false } },
  { id: 'zed', title: 'Zed', placement: { startMenu: { category: 'Office' } } },
  { id: 'single', title: 'Single', instances: { single: true } },
  { id: 'capped', title: 'Capped', instances: { max: 1 } },
];

function setup() {
  const manager = createWindowManager({ apps });
  manager.setViewport({ width: 1000, height: 700 });
  const components = Object.fromEntries(apps.map((app) => [app.id, () => null]));
  const { result } = renderHook(() => useStartMenu(), {
    wrapper: createWrapper(manager, components),
  });
  return { manager, result };
}

describe('useStartMenu: listing', () => {
  it('groups apps by category, sorted, and leaves out hidden apps', () => {
    const { result } = setup();
    expect(result.current.categories.map((category) => category.name)).toEqual(['Apps', 'Office']);
    expect(result.current.categories[0]?.apps.map((app) => app.title)).toEqual([
      'Calculator',
      'Capped',
      'Single',
    ]);
    expect(result.current.categories[1]?.apps.map((app) => app.title)).toEqual(['Notes', 'Zed']);
    expect(result.current.results.map((app) => app.appId)).not.toContain('hidden');
  });

  it('carries category and keywords on the entries', () => {
    const { result } = setup();
    const notes = result.current.results.find((app) => app.appId === 'notes');
    expect(notes).toMatchObject({ category: 'Office', keywords: ['text', 'write'] });
  });
});

describe('useStartMenu: search', () => {
  it('matches the title, the category and keywords', () => {
    const { result } = setup();
    act(() => result.current.setSearch('calc'));
    expect(result.current.results.map((app) => app.appId)).toEqual(['calc']);
    act(() => result.current.setSearch('office'));
    expect(result.current.results.map((app) => app.appId)).toEqual(['notes', 'zed']);
    act(() => result.current.setSearch('WRITE'));
    expect(result.current.results.map((app) => app.appId)).toEqual(['notes']);
  });

  it('needs every typed word to match', () => {
    const { result } = setup();
    act(() => result.current.setSearch('office write'));
    expect(result.current.results.map((app) => app.appId)).toEqual(['notes']);
    act(() => result.current.setSearch('office calc'));
    expect(result.current.results).toEqual([]);
    expect(result.current.categories).toEqual([]);
  });

  it('shows everything for blank text', () => {
    const { result } = setup();
    act(() => result.current.setSearch('   '));
    expect(result.current.results).toHaveLength(5);
  });
});

describe('useStartMenu: open state and launching', () => {
  it('opens, toggles and closes, clearing the search when it closes', () => {
    const { result } = setup();
    expect(result.current.open).toBe(false);
    act(() => result.current.setOpen(true));
    act(() => result.current.setSearch('zed'));
    expect(result.current.open).toBe(true);
    expect(result.current.search).toBe('zed');

    act(() => result.current.toggle());
    expect(result.current.open).toBe(false);
    expect(result.current.search).toBe('');
  });

  it('launches an app, then closes the menu and clears the search', () => {
    const { manager, result } = setup();
    act(() => result.current.setOpen(true));
    act(() => result.current.setSearch('calc'));
    act(() => result.current.launch('calc'));
    expect(Object.values(manager.getState().windows).map((win) => win.appId)).toEqual(['calc']);
    expect(result.current.open).toBe(false);
    expect(result.current.search).toBe('');
  });

  it('focuses the existing window of a single-instance app', () => {
    const { manager, result } = setup();
    act(() => result.current.launch('single'));
    const first = manager.getState().focusedId;
    manager.open({ appId: 'calc' });
    act(() => result.current.launch('single'));
    expect(Object.keys(manager.getState().windows)).toHaveLength(2);
    expect(manager.getState().focusedId).toBe(first);
  });

  it('focuses the topmost window instead of throwing when the instance limit is reached', () => {
    const { manager, result } = setup();
    act(() => result.current.launch('capped'));
    const capped = manager.getState().focusedId;
    manager.open({ appId: 'calc' });
    expect(() => act(() => result.current.launch('capped'))).not.toThrow();
    expect(manager.getState().focusedId).toBe(capped);
    expect(Object.keys(manager.getState().windows)).toHaveLength(2);
  });
});
