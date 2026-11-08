import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createTestManager, createWrapper } from '../../test/harness';
import type { Wallpaper, WindowManager } from '../core/types';
import { useWindowManagerContext } from '../react/windowManagerContext';
import { WallpaperPicker, type WallpaperPickerProps } from './WallpaperPicker';

function wallpaperOf(manager: WindowManager, desktopId = 'desktop-1'): Wallpaper | null {
  return manager.getState().desktops.find((desktop) => desktop.id === desktopId)?.wallpaper ?? null;
}

function setup(props: WallpaperPickerProps = {}) {
  const manager = createTestManager();
  render(<WallpaperPicker {...props} />, { wrapper: createWrapper(manager) });
  return { manager, user: userEvent.setup() };
}

describe('WallpaperPicker', () => {
  it('previews the current wallpaper', () => {
    const manager = createTestManager();
    manager.setWallpaper('desktop-1', { type: 'color', value: 'rgb(9, 8, 7)' });
    render(<WallpaperPicker />, { wrapper: createWrapper(manager) });
    expect(screen.getByRole('img', { name: 'Current wallpaper' }).style.background).toBe(
      'rgb(9, 8, 7)',
    );
  });

  it('opens on the tab of the current wallpaper kind', () => {
    const manager = createTestManager();
    manager.setWallpaper('desktop-1', { type: 'gradient', value: 'linear-gradient(red, blue)' });
    render(<WallpaperPicker />, { wrapper: createWrapper(manager) });
    expect(screen.getByRole('tab', { name: 'Gradient' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('uses the theme background', async () => {
    const { manager, user } = setup();
    act(() => manager.setWallpaper('desktop-1', { type: 'color', value: 'red' }));
    await user.click(screen.getByRole('tab', { name: 'Theme' }));
    await user.click(screen.getByRole('button', { name: 'Use the theme background' }));
    expect(wallpaperOf(manager)).toEqual({ type: 'theme' });
  });

  describe('color', () => {
    it('applies a preset at once and marks it', async () => {
      const { manager, user } = setup();
      await user.click(screen.getByRole('tab', { name: 'Color' }));
      await user.click(screen.getByRole('button', { name: 'Accent' }));
      expect(wallpaperOf(manager)).toEqual({ type: 'color', value: 'var(--accent)' });
      expect(screen.getByRole('button', { name: 'Accent' }).getAttribute('aria-pressed')).toBe(
        'true',
      );
      expect(screen.getByRole('button', { name: 'Primary' }).getAttribute('aria-pressed')).toBe(
        'false',
      );
    });

    it('applies a custom color', async () => {
      const { manager, user } = setup();
      await user.click(screen.getByRole('tab', { name: 'Color' }));
      await user.type(screen.getByLabelText('Custom color'), 'rgb(10, 20, 30)');
      await user.click(screen.getByRole('button', { name: 'Apply' }));
      expect(wallpaperOf(manager)).toEqual({ type: 'color', value: 'rgb(10, 20, 30)' });
    });

    it('rejects an empty custom color', async () => {
      const { manager, user } = setup();
      await user.click(screen.getByRole('tab', { name: 'Color' }));
      await user.click(screen.getByRole('button', { name: 'Apply' }));
      expect((await screen.findByRole('alert')).textContent).toBe('Enter a valid CSS color.');
      expect(wallpaperOf(manager)).toBeNull();
    });
  });

  describe('gradient', () => {
    it('applies a preset', async () => {
      const { manager, user } = setup();
      await user.click(screen.getByRole('tab', { name: 'Gradient' }));
      await user.click(screen.getByRole('button', { name: 'Accent glow' }));
      expect(wallpaperOf(manager)).toEqual({
        type: 'gradient',
        value: 'radial-gradient(circle at top, var(--accent), var(--background))',
      });
    });

    it('applies a custom gradient', async () => {
      const { manager, user } = setup();
      await user.click(screen.getByRole('tab', { name: 'Gradient' }));
      await user.type(screen.getByLabelText('Custom gradient'), 'conic-gradient(red, blue)');
      await user.click(screen.getByRole('button', { name: 'Apply' }));
      expect(wallpaperOf(manager)).toEqual({
        type: 'gradient',
        value: 'conic-gradient(red, blue)',
      });
    });

    it('rejects text that is not a gradient', async () => {
      const { manager, user } = setup();
      await user.click(screen.getByRole('tab', { name: 'Gradient' }));
      await user.type(screen.getByLabelText('Custom gradient'), 'red');
      await user.click(screen.getByRole('button', { name: 'Apply' }));
      expect((await screen.findByRole('alert')).textContent).toContain('CSS gradient');
      expect(wallpaperOf(manager)).toBeNull();
    });
  });

  describe('image', () => {
    it('applies an image URL with the chosen fit', async () => {
      const { manager, user } = setup();
      await user.click(screen.getByRole('tab', { name: 'Image' }));
      await user.click(screen.getByRole('radio', { name: 'Fit' }));
      await user.type(screen.getByLabelText('Image URL'), 'https://example.com/a.jpg');
      await user.click(screen.getByRole('button', { name: 'Apply' }));
      expect(wallpaperOf(manager)).toEqual({
        type: 'image',
        url: 'https://example.com/a.jpg',
        fit: 'contain',
      });
    });

    it('changes the fit of the current image at once', async () => {
      const manager = createTestManager();
      manager.setWallpaper('desktop-1', { type: 'image', url: 'https://example.com/a.jpg' });
      const user = userEvent.setup();
      render(<WallpaperPicker />, { wrapper: createWrapper(manager) });
      expect(screen.getByRole('radio', { name: 'Fill' }).getAttribute('aria-checked')).toBe('true');
      await user.click(screen.getByRole('radio', { name: 'Center' }));
      expect(wallpaperOf(manager)).toEqual({
        type: 'image',
        url: 'https://example.com/a.jpg',
        fit: 'center',
      });
    });

    it('rejects an empty URL', async () => {
      const { manager, user } = setup();
      await user.click(screen.getByRole('tab', { name: 'Image' }));
      await user.click(screen.getByRole('button', { name: 'Apply' }));
      expect((await screen.findByRole('alert')).textContent).toBe('Enter the address of an image.');
      expect(wallpaperOf(manager)).toBeNull();
    });

    it('has no upload button without onUpload', async () => {
      const { user } = setup();
      await user.click(screen.getByRole('tab', { name: 'Image' }));
      expect(screen.queryByLabelText('Upload an image')).toBeNull();
    });

    it('stores an uploaded file through onUpload and uses the URL it returns', async () => {
      const onUpload = vi.fn(async (_file: File) => 'https://cdn.example.com/up.png');
      const { manager, user } = setup({ onUpload });
      await user.click(screen.getByRole('tab', { name: 'Image' }));
      const file = new File(['x'], 'up.png', { type: 'image/png' });
      await user.upload(screen.getByLabelText('Upload an image'), file);
      await waitFor(() =>
        expect(wallpaperOf(manager)).toEqual({
          type: 'image',
          url: 'https://cdn.example.com/up.png',
          fit: 'cover',
        }),
      );
      expect(onUpload).toHaveBeenCalledWith(file);
    });

    it('shows an error when the upload fails and keeps the wallpaper', async () => {
      const onUpload = vi.fn(async (_file: File) => {
        throw new Error('nope');
      });
      const { manager, user } = setup({ onUpload });
      await user.click(screen.getByRole('tab', { name: 'Image' }));
      await user.upload(
        screen.getByLabelText('Upload an image'),
        new File(['x'], 'up.png', { type: 'image/png' }),
      );
      expect((await screen.findByRole('alert')).textContent).toBe(
        'The image could not be uploaded.',
      );
      expect(wallpaperOf(manager)).toBeNull();
    });
  });

  it('changes the wallpaper of the desktop named by desktopId', async () => {
    const manager = createTestManager();
    const second = manager.addDesktop('Work');
    const user = userEvent.setup();
    render(<WallpaperPicker desktopId={second} />, { wrapper: createWrapper(manager) });
    await user.click(screen.getByRole('tab', { name: 'Color' }));
    await user.click(screen.getByRole('button', { name: 'Primary' }));
    expect(wallpaperOf(manager, second)).toEqual({ type: 'color', value: 'var(--primary)' });
    expect(wallpaperOf(manager)).toBeNull();
  });

  it('follows the active desktop when no desktop is named', async () => {
    const manager = createTestManager();
    const second = manager.addDesktop('Work');
    const user = userEvent.setup();
    render(<WallpaperPicker />, { wrapper: createWrapper(manager) });
    act(() => manager.switchDesktop(second));
    await user.click(screen.getByRole('tab', { name: 'Color' }));
    await user.click(screen.getByRole('button', { name: 'Muted' }));
    expect(wallpaperOf(manager, second)).toEqual({ type: 'color', value: 'var(--muted)' });
  });

  it('accepts className, style and a ref', () => {
    const manager = createTestManager();
    let node: HTMLDivElement | null = null;
    render(
      <WallpaperPicker
        className="custom"
        style={{ opacity: 0.8 }}
        ref={(element) => {
          node = element;
        }}
      />,
      { wrapper: createWrapper(manager) },
    );
    const picker = document.querySelector<HTMLElement>('[data-wm-wallpaper-picker]');
    expect(picker).toBe(node);
    expect(picker?.classList.contains('custom')).toBe(true);
    expect(picker?.style.opacity).toBe('0.8');
  });
});

function Opener() {
  const { stores } = useWindowManagerContext();
  return (
    <button type="button" onClick={() => stores.wallpaperPicker.set(true)}>
      Open picker
    </button>
  );
}

describe('WallpaperPicker as a dialog', () => {
  function setupDialog() {
    const manager = createTestManager();
    render(
      <>
        <Opener />
        <WallpaperPicker dialog />
      </>,
      { wrapper: createWrapper(manager) },
    );
    return { manager, user: userEvent.setup() };
  }

  it('is closed until it is opened', () => {
    setupDialog();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens from the store, names the desktop and applies a choice', async () => {
    const { manager, user } = setupDialog();
    await user.click(screen.getByRole('button', { name: 'Open picker' }));
    const dialog = await screen.findByRole('dialog', { name: 'Wallpaper' });
    expect(dialog.textContent).toContain('Choose the wallpaper of Desktop 1.');
    await user.click(screen.getByRole('tab', { name: 'Color' }));
    await user.click(screen.getByRole('button', { name: 'Success' }));
    expect(wallpaperOf(manager)).toEqual({ type: 'color', value: 'var(--success)' });
  });

  it('closes with Escape', async () => {
    const { user } = setupDialog();
    await user.click(screen.getByRole('button', { name: 'Open picker' }));
    await screen.findByRole('dialog', { name: 'Wallpaper' });
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
