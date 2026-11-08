import { useEffect, useMemo, useState } from 'react';

/** Options of `useClock`. */
export interface UseClockOptions {
  /** A BCP 47 locale such as `"en-GB"`. Default: the browser's. */
  locale?: string;
  /** Force a 12 or 24 hour clock. Default: the locale's. */
  hour12?: boolean;
  /** Show seconds (the clock then ticks every second instead of every minute). Default false. */
  showSeconds?: boolean;
}

/** What `useClock` returns. */
export interface UseClockResult {
  /** The current time, updated on every tick. */
  now: Date;
  /** For example "14:05". */
  time: string;
  /** For example "Fri, Nov 6". */
  date: string;
  /** For example "Friday, November 6, 2026". */
  fullDate: string;
}

/** Milliseconds from `date` to the next minute (or second) boundary. */
export function msToNextTick(date: Date, showSeconds: boolean): number {
  const intoSecond = date.getMilliseconds();
  const wait = showSeconds ? 1000 - intoSecond : 60_000 - (date.getSeconds() * 1000 + intoSecond);
  return Math.max(1, wait);
}

/**
 * The current time and date, formatted for a locale. It updates exactly when the minute (or the
 * second, with `showSeconds`) changes, not on a fixed interval, so the clock never lags.
 */
export function useClock(options: UseClockOptions = {}): UseClockResult {
  const { locale, hour12, showSeconds = false } = options;
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = (): void => {
      timer = setTimeout(
        () => {
          const current = new Date();
          setNow(current);
          schedule();
        },
        msToNextTick(new Date(), showSeconds),
      );
    };
    setNow(new Date());
    schedule();
    return () => {
      if (timer !== undefined) clearTimeout(timer);
    };
  }, [showSeconds]);

  const formats = useMemo(
    () => ({
      time: new Intl.DateTimeFormat(locale, {
        hour: 'numeric',
        minute: '2-digit',
        ...(showSeconds ? { second: '2-digit' as const } : {}),
        ...(hour12 === undefined ? {} : { hour12 }),
      }),
      date: new Intl.DateTimeFormat(locale, { weekday: 'short', month: 'short', day: 'numeric' }),
      fullDate: new Intl.DateTimeFormat(locale, { dateStyle: 'full' }),
    }),
    [locale, hour12, showSeconds],
  );

  return {
    now,
    time: formats.time.format(now),
    date: formats.date.format(now),
    fullDate: formats.fullDate.format(now),
  };
}
