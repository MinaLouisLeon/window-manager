import {
  Button,
  cn,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ToggleGroup,
  ToggleGroupItem,
} from '@integr8-media/ui';
import { type CSSProperties, type FormEvent, type ReactElement, type Ref, useState } from 'react';
import type { Desktop, DesktopId, Wallpaper } from '../core/types';
import { useExternalStore } from '../react/externalStore';
import { useManagerSelector } from '../react/useManagerSelector';
import { wallpaperStyle } from '../react/wallpaperStyle';
import { useWindowManagerContext } from '../react/windowManagerContext';

/** Props of `WallpaperPicker`. */
export interface WallpaperPickerProps {
  /** The desktop to change. Default: the active desktop. */
  desktopId?: DesktopId;
  /**
   * Turns a file the user picked into an image URL: the app stores the upload and returns where
   * it can be loaded from. Without it there is no upload button.
   */
  onUpload?: (file: File) => string | Promise<string>;
  /**
   * Draw the picker inside a dialog that the desktop menu's "Change wallpaper…" opens (the
   * `Desktop` component does this). Default false: the picker is drawn in place.
   */
  dialog?: boolean;
  className?: string;
  style?: CSSProperties;
  ref?: Ref<HTMLDivElement>;
}

type Fit = 'cover' | 'contain' | 'center';
type Kind = 'theme' | 'color' | 'gradient' | 'image';

/** Colors from the theme tokens, so a wallpaper follows the active theme. */
const COLORS: readonly { label: string; value: string }[] = [
  { label: 'Primary', value: 'var(--primary)' },
  { label: 'Secondary', value: 'var(--secondary)' },
  { label: 'Accent', value: 'var(--accent)' },
  { label: 'Muted', value: 'var(--muted)' },
  { label: 'Card', value: 'var(--card)' },
  { label: 'Foreground', value: 'var(--foreground)' },
  { label: 'Destructive', value: 'var(--destructive)' },
  { label: 'Success', value: 'var(--success)' },
  { label: 'Warning', value: 'var(--warning)' },
];

/** Gradients from the theme tokens. */
const GRADIENTS: readonly { label: string; value: string }[] = [
  {
    label: 'Primary to accent',
    value: 'linear-gradient(135deg, var(--primary), var(--accent))',
  },
  {
    label: 'Background to muted',
    value: 'linear-gradient(135deg, var(--background), var(--muted))',
  },
  {
    label: 'Primary to background',
    value: 'linear-gradient(160deg, var(--primary), var(--background))',
  },
  {
    label: 'Success to primary',
    value: 'linear-gradient(135deg, var(--success), var(--primary))',
  },
  {
    label: 'Accent glow',
    value: 'radial-gradient(circle at top, var(--accent), var(--background))',
  },
  {
    label: 'Warning to destructive',
    value: 'linear-gradient(135deg, var(--warning), var(--destructive))',
  },
];

const FITS: readonly { value: Fit; label: string }[] = [
  { value: 'cover', label: 'Fill' },
  { value: 'contain', label: 'Fit' },
  { value: 'center', label: 'Center' },
];

/** True when the browser understands `value` as a color (any non-empty text without a browser). */
function isColor(value: string): boolean {
  if (typeof CSS !== 'undefined' && typeof CSS.supports === 'function') {
    return CSS.supports('color', value);
  }
  return value.length > 0;
}

function isGradient(value: string): boolean {
  return /^(repeating-)?(linear|radial|conic)-gradient\(.+\)$/i.test(value);
}

function kindOf(wallpaper: Wallpaper | null): Kind {
  return wallpaper === null ? 'theme' : wallpaper.type;
}

function Swatch({
  label,
  value,
  active,
  onPick,
}: {
  label: string;
  value: string;
  active: boolean;
  onPick: () => void;
}): ReactElement {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        'h-10 w-14 rounded-md border border-border outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring aria-pressed:ring-2 aria-pressed:ring-primary',
      )}
      style={{ background: value }}
      onClick={onPick}
    />
  );
}

/** A one-line form: a text field and an Apply button; shows what is wrong with the text. */
function ApplyForm({
  label,
  placeholder,
  initial,
  validate,
  onApply,
}: {
  label: string;
  placeholder: string;
  initial: string;
  validate: (value: string) => string | null;
  onApply: (value: string) => void;
}): ReactElement {
  const [error, setError] = useState<string | null>(null);
  const submit = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get('value') ?? '').trim();
    const problem = validate(value);
    setError(problem);
    if (problem === null) onApply(value);
  };
  return (
    <form className="flex flex-col gap-1" onSubmit={submit}>
      <div className="flex gap-2">
        <Input
          name="value"
          aria-label={label}
          aria-invalid={error !== null}
          placeholder={placeholder}
          defaultValue={initial}
        />
        <Button type="submit" variant="secondary">
          Apply
        </Button>
      </div>
      {error === null ? null : (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

function WallpaperPanel({
  desktop,
  onUpload,
}: {
  desktop: Desktop;
  onUpload: WallpaperPickerProps['onUpload'];
}): ReactElement {
  const { manager } = useWindowManagerContext();
  const wallpaper = desktop.wallpaper;
  const [fit, setFit] = useState<Fit>(
    wallpaper?.type === 'image' ? (wallpaper.fit ?? 'cover') : 'cover',
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const apply = (next: Wallpaper | null): void => manager.setWallpaper(desktop.id, next);

  const pickFile = async (file: File | undefined): Promise<void> => {
    if (file === undefined || onUpload === undefined) return;
    setUploadError(null);
    setUploading(true);
    try {
      const url = await onUpload(file);
      apply({ type: 'image', url, fit });
    } catch {
      setUploadError('The image could not be uploaded.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div
        role="img"
        aria-label="Current wallpaper"
        data-wm-wallpaper-preview=""
        className="aspect-video w-full rounded-md border border-border"
        style={wallpaperStyle(wallpaper)}
      />
      <Tabs defaultValue={kindOf(wallpaper)}>
        <TabsList>
          <TabsTrigger value="theme">Theme</TabsTrigger>
          <TabsTrigger value="color">Color</TabsTrigger>
          <TabsTrigger value="gradient">Gradient</TabsTrigger>
          <TabsTrigger value="image">Image</TabsTrigger>
        </TabsList>

        <TabsContent value="theme" className="flex flex-col gap-2 pt-2">
          <p className="text-sm text-muted-foreground">
            The background of the current theme. It follows theme changes.
          </p>
          <Button
            variant="secondary"
            className="self-start"
            aria-pressed={kindOf(wallpaper) === 'theme'}
            onClick={() => apply({ type: 'theme' })}
          >
            Use the theme background
          </Button>
        </TabsContent>

        <TabsContent value="color" className="flex flex-col gap-3 pt-2">
          <div className="flex flex-wrap gap-2">
            {COLORS.map((color) => (
              <Swatch
                key={color.value}
                {...color}
                active={wallpaper?.type === 'color' && wallpaper.value === color.value}
                onPick={() => apply({ type: 'color', value: color.value })}
              />
            ))}
          </div>
          <ApplyForm
            label="Custom color"
            placeholder="Any CSS color, for example oklch(0.3 0.05 260)"
            initial={wallpaper?.type === 'color' ? wallpaper.value : ''}
            validate={(value) => (isColor(value) ? null : 'Enter a valid CSS color.')}
            onApply={(value) => apply({ type: 'color', value })}
          />
        </TabsContent>

        <TabsContent value="gradient" className="flex flex-col gap-3 pt-2">
          <div className="flex flex-wrap gap-2">
            {GRADIENTS.map((gradient) => (
              <Swatch
                key={gradient.value}
                {...gradient}
                active={wallpaper?.type === 'gradient' && wallpaper.value === gradient.value}
                onPick={() => apply({ type: 'gradient', value: gradient.value })}
              />
            ))}
          </div>
          <ApplyForm
            label="Custom gradient"
            placeholder="linear-gradient(135deg, var(--primary), var(--accent))"
            initial={wallpaper?.type === 'gradient' ? wallpaper.value : ''}
            validate={(value) =>
              isGradient(value) ? null : 'Enter a CSS gradient, such as linear-gradient(…).'
            }
            onApply={(value) => apply({ type: 'gradient', value })}
          />
        </TabsContent>

        <TabsContent value="image" className="flex flex-col gap-3 pt-2">
          <ApplyForm
            label="Image URL"
            placeholder="https://example.com/wallpaper.jpg"
            initial={wallpaper?.type === 'image' ? wallpaper.url : ''}
            validate={(value) => (value === '' ? 'Enter the address of an image.' : null)}
            onApply={(url) => apply({ type: 'image', url, fit })}
          />
          <ToggleGroup
            type="single"
            variant="outline"
            size="sm"
            aria-label="Image fit"
            value={fit}
            onValueChange={(value) => {
              if (value === '') return;
              const next = value as Fit;
              setFit(next);
              if (wallpaper?.type === 'image') apply({ ...wallpaper, fit: next });
            }}
          >
            {FITS.map((entry) => (
              <ToggleGroupItem key={entry.value} value={entry.value} className="px-3">
                {entry.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {onUpload === undefined ? null : (
            <div className="flex flex-col gap-1">
              <Input
                type="file"
                accept="image/*"
                aria-label="Upload an image"
                data-wm-wallpaper-file=""
                disabled={uploading}
                onChange={(event) => {
                  void pickFile(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
              {uploading ? (
                <p role="status" className="text-xs text-muted-foreground">
                  Uploading…
                </p>
              ) : null}
              {uploadError === null ? null : (
                <p role="alert" className="text-xs text-destructive">
                  {uploadError}
                </p>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

/**
 * Chooses the wallpaper of a desktop: the theme's own background, a color, a gradient (presets
 * built from the theme tokens, or any CSS color or gradient) or an image (a URL, or an uploaded
 * file when `onUpload` stores it and returns its URL). A choice applies at once. With `dialog` it
 * lives in a dialog opened from the desktop menu ("Change wallpaper…"); `Desktop` draws that
 * one.
 */
export function WallpaperPicker({
  desktopId,
  onUpload,
  dialog = false,
  className,
  style,
  ref,
}: WallpaperPickerProps): ReactElement {
  const { stores } = useWindowManagerContext();
  const open = useExternalStore(stores.wallpaperPicker);
  const desktop = useManagerSelector(
    (state) =>
      (state.desktops.find((entry) => entry.id === (desktopId ?? state.activeDesktopId)) ??
        state.desktops[0]) as Desktop,
  );

  if (dialog) {
    return (
      <Dialog open={open} onOpenChange={(next) => stores.wallpaperPicker.set(next)}>
        <DialogContent
          ref={ref}
          data-wm-wallpaper-dialog=""
          className={cn('max-w-md', className)}
          style={style}
        >
          <DialogHeader>
            <DialogTitle>Wallpaper</DialogTitle>
            <DialogDescription>Choose the wallpaper of {desktop.name}.</DialogDescription>
          </DialogHeader>
          <WallpaperPanel key={desktop.id} desktop={desktop} onUpload={onUpload} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div ref={ref} data-wm-wallpaper-picker="" className={className} style={style}>
      <WallpaperPanel key={desktop.id} desktop={desktop} onUpload={onUpload} />
    </div>
  );
}
