import { useCallback, useEffect, useState } from 'react';
import {
  calendarStateSchema,
  capabilitiesSchema,
  notetakerSchema,
  type CalendarState,
  type Capabilities,
  type Notetaker,
} from '../../../../packages/shared/notetaker';
import { uploadApi } from './uploads';

export const notetakerStatusLabels: Record<Notetaker['status'], string> = {
  scheduled: 'Scheduled',
  joining: 'Joining',
  waiting_room: 'In waiting room',
  recording: 'Recording',
  processing: 'Processing',
  complete: 'Done',
  failed: 'Not recorded',
  cancelled: 'Cancelled',
};

/** The current time, refreshed on an interval while `active`. */
export function useNow(intervalMs: number, active = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs, active]);
  return now;
}

export async function fetchCapabilities(): Promise<Capabilities> {
  return capabilitiesSchema.parse(await uploadApi('capabilities'));
}

export function useCapabilities() {
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  useEffect(() => {
    let disposed = false;
    fetchCapabilities()
      .then((value) => !disposed && setCapabilities(value))
      .catch(() => !disposed && setCapabilities({ bot: false, calendar: false }));
    return () => {
      disposed = true;
    };
  }, []);
  return capabilities;
}

export async function createNotetaker(input: {
  provider: 'recall' | 'browser';
  title?: string;
  meetingUrl?: string;
}) {
  return notetakerSchema.parse(await uploadApi('notetakers', 'POST', input));
}

export async function cancelNotetaker(id: string) {
  return notetakerSchema.parse(await uploadApi(`notetakers/${id}`, 'DELETE'));
}

export async function addHighlight(id: string, note: string) {
  return notetakerSchema.parse(
    await uploadApi(`notetakers/${id}/highlights`, 'POST', { note }),
  );
}

/** Polls a notetaker while it is live; stops once it has settled. */
export function useNotetaker(id: string) {
  const [notetaker, setNotetaker] = useState<Notetaker | null>(null);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  /** Server clock minus this clock, so call timers match the server. */
  const [skew, setSkew] = useState(0);
  const refresh = useCallback(() => setTick((value) => value + 1), []);
  useEffect(() => {
    let disposed = false;
    let timer: number;
    async function load() {
      let settled = false;
      try {
        const value = notetakerSchema.parse(await uploadApi(`notetakers/${id}`));
        settled = ['complete', 'failed', 'cancelled'].includes(value.status);
        if (!disposed) {
          setSkew(Date.parse(value.serverTime) - Date.now());
          setNotetaker(value);
          setError('');
        }
      } catch (e) {
        if (!disposed)
          setError(e instanceof Error ? e.message : 'This call could not load.');
      }
      if (!disposed && !settled) timer = window.setTimeout(() => void load(), 4000);
    }
    void load();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [id, tick]);
  return { notetaker, setNotetaker, error, refresh, skew };
}

/** Live and upcoming notetakers, refreshed while any of them is moving. */
export function useActiveNotetakers() {
  const [items, setItems] = useState<Notetaker[] | null>(null);
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((value) => value + 1), []);
  useEffect(() => {
    let disposed = false;
    let timer: number;
    async function load() {
      try {
        const value = notetakerSchema
          .array()
          .parse(await uploadApi('notetakers?active=1'));
        if (!disposed) setItems(value);
        if (!disposed && value.some((item) => item.status !== 'scheduled'))
          timer = window.setTimeout(() => void load(), 8000);
      } catch {
        if (!disposed) setItems([]);
      }
    }
    void load();
    return () => {
      disposed = true;
      clearTimeout(timer);
    };
  }, [tick]);
  return { items, refresh };
}

export function useCalendar(enabled: boolean) {
  const [state, setState] = useState<CalendarState | null>(null);
  const [error, setError] = useState('');
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((value) => value + 1), []);
  useEffect(() => {
    if (!enabled) return;
    let disposed = false;
    uploadApi('calendar')
      .then((value) => {
        if (!disposed) {
          setState(calendarStateSchema.parse(value));
          setError('');
        }
      })
      .catch((e: unknown) => {
        if (!disposed)
          setError(e instanceof Error ? e.message : 'Your calendar could not load.');
      });
    return () => {
      disposed = true;
    };
  }, [enabled, tick]);
  return { state, setState, error, refresh };
}

export async function toggleEventNotetaker(eventId: string, enabled: boolean) {
  const value = await uploadApi(
    `calendar/events/${encodeURIComponent(eventId)}/notetaker`,
    'POST',
    { enabled },
  );
  return value === null ? null : notetakerSchema.parse(value);
}

export async function setAutoRecord(autoRecord: boolean) {
  await uploadApi('calendar', 'PATCH', { autoRecord });
}

export async function disconnectCalendar() {
  await uploadApi('calendar', 'DELETE');
}
