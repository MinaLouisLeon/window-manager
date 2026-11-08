import { describe, expect, it } from 'vitest';
import { createWindowManager } from './createWindowManager';

const apps = [{ id: 'notes', title: 'Notes' }];

describe('getConfig', () => {
  it('returns the defaults', () => {
    expect(createWindowManager({ apps }).getConfig()).toEqual({
      snapThreshold: 16,
      edgeMagnet: 8,
      minVisibleTitleBar: 48,
      cascadeOffset: 24,
    });
  });

  it('returns the options that were given', () => {
    const config = createWindowManager({
      apps,
      snapThreshold: 30,
      edgeMagnet: 12,
      minVisibleTitleBar: 60,
      cascadeOffset: 10,
    }).getConfig();
    expect(config).toEqual({
      snapThreshold: 30,
      edgeMagnet: 12,
      minVisibleTitleBar: 60,
      cascadeOffset: 10,
    });
  });

  it('keeps edgeMagnet false (the magnet is off)', () => {
    expect(createWindowManager({ apps, edgeMagnet: false }).getConfig().edgeMagnet).toBe(false);
  });

  it('returns the same object every time', () => {
    const manager = createWindowManager({ apps });
    expect(manager.getConfig()).toBe(manager.getConfig());
  });
});
