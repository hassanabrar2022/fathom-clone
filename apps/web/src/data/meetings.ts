import { useEffect, useState } from 'react';
import { z } from 'zod';
import { meetingSchema } from '../../../../packages/shared/meeting';
import {
  meetingSearchDocumentSchema,
  type MeetingSearchResult,
} from '../../../../packages/shared/search';
export const librarySchema = meetingSchema.array();
export const meetingDetailSchema = z.object({
  meeting: meetingSchema,
  searchDocument: meetingSearchDocumentSchema,
});
export const searchResultsSchema = z.array(
  z.object({
    meeting: meetingSchema,
    matches: z.array(
      z.object({
        id: z.string(),
        kind: z.enum(['title', 'summary', 'participant', 'transcript']),
        text: z.string(),
        speaker: z.string().optional(),
        timestamp: z.number().optional(),
      }),
    ),
  }),
);

export function useApiData<T>(path: string | undefined, schema: z.ZodType<T>) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{
    path: string;
    attempt: number;
    data?: T;
    error?: string;
    missing?: boolean;
  }>();
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let disposed = false;
    fetch(path, { signal: controller.signal, credentials: 'same-origin' })
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            response.status === 404 ? 'not-found' : 'unavailable',
          );
        return schema.parse(await response.json());
      })
      .then((data) => {
        if (!disposed) setState({ path, attempt, data });
      })
      .catch((error) => {
        if (!disposed)
          setState({
            path,
            attempt,
            missing: error instanceof Error && error.message === 'not-found',
            error:
              'Meeting data couldn’t load. Check your connection and retry.',
          });
      })
      .finally(() => clearTimeout(timeout));
    return () => {
      disposed = true;
      controller.abort();
      clearTimeout(timeout);
    };
  }, [path, schema, attempt]);
  const current =
    state && state.path === path && state.attempt === attempt
      ? state
      : undefined;
  return {
    missing: current?.missing,
    data: current?.data,
    error: current?.error,
    loading: !!path && !current,
    retry: () => setAttempt((n) => n + 1),
  };
}
export function useMeetingSearch(query: string, category: string) {
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 250);
    return () => clearTimeout(timer);
  }, [query]);
  const result = useApiData(
    debounced
      ? `/api/search?q=${encodeURIComponent(debounced)}&category=${encodeURIComponent(category)}`
      : undefined,
    searchResultsSchema,
  );
  return {
    ...result,
    data: (query === debounced ? result.data : undefined) as
      MeetingSearchResult[] | undefined,
    loading: !!query && (query !== debounced || result.loading),
  };
}
