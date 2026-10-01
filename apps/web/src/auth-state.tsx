import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { z } from 'zod';

const userSchema = z.object({ id: z.uuid(), email: z.email() });
type User = z.infer<typeof userSchema>;
export const sessionSchema = z.object({ user: userSchema.nullable() });
type AuthState = {
  user: User | null;
  loading: boolean;
  /** True after the user chose to leave (sign out or account deletion). */
  leaving: boolean;
  /** Clears the session locally after the server already ended it. */
  forget: () => void;
  refresh: () => Promise<User | null>;
  signOut: () => Promise<void>;
};
const Context = createContext<AuthState | null>(null);
const signedOutEvent = 'fathom-clone-signed-out';
/** Called by API clients when the server reports an expired session. */
export function reportSignedOut() {
  window.dispatchEvent(new Event(signedOutEvent));
}
export async function accountRequest(
  path: string,
  method = 'GET',
  body?: unknown,
) {
  const response = await fetch(`/api/auth/${path}`, {
    method,
    credentials: 'same-origin',
    signal: AbortSignal.timeout(20000),
    headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  });
  const value = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      value?.message ?? 'The account service is unavailable. Please retry.',
    );
  return value as unknown;
}
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const refresh = useCallback(async () => {
    const result = sessionSchema.parse(await accountRequest('session'));
    setUser(result.user);
    return result.user;
  }, []);
  useEffect(() => {
    let active = true;
    accountRequest('session')
      .then((result) => {
        if (active) setUser(sessionSchema.parse(result).user);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    const signedOut = () => setUser(null);
    window.addEventListener(signedOutEvent, signedOut);
    return () => {
      active = false;
      window.removeEventListener(signedOutEvent, signedOut);
    };
  }, []);
  const signOut = useCallback(async () => {
    await accountRequest('logout', 'POST');
    setLeaving(true);
    setUser(null);
  }, []);
  const forget = useCallback(() => {
    setLeaving(true);
    setUser(null);
  }, []);
  return (
    <Context.Provider
      value={{ user, loading, leaving, forget, refresh, signOut }}
    >
      {children}
    </Context.Provider>
  );
}
export function useAuth() {
  const value = useContext(Context);
  if (!value) throw new Error('AuthProvider is missing');
  return value;
}
