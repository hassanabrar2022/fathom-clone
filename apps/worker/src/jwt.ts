/**
 * Local verification of Supabase access tokens signed with asymmetric keys,
 * so ordinary API requests don't need a round trip to Supabase Auth.
 * Returns undefined when the token can't be checked locally (unknown key or a
 * legacy shared-secret token); callers then ask Supabase instead.
 */
type Jwk = JsonWebKey & { kid?: string; alg?: string };
type Claims = {
  sub?: string;
  email?: string;
  exp?: number;
  iss?: string;
  aud?: string | string[];
  role?: string;
};

const JWKS_TTL_MS = 10 * 60 * 1000;
let cached: { url: string; at: number; keys: Map<string, CryptoKey> } | null =
  null;

function base64UrlDecode(value: string) {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function signingKeys(supabaseUrl: string, refresh = false) {
  const url = `${supabaseUrl.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`;
  if (
    !refresh &&
    cached?.url === url &&
    Date.now() - cached.at < JWKS_TTL_MS
  )
    return cached.keys;
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('Signing keys unavailable');
  const { keys } = (await response.json()) as { keys: Jwk[] };
  const imported = new Map<string, CryptoKey>();
  for (const key of keys) {
    if (!key.kid || key.kty !== 'EC' || key.crv !== 'P-256') continue;
    imported.set(
      key.kid,
      await crypto.subtle.importKey(
        'jwk',
        key,
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['verify'],
      ),
    );
  }
  cached = { url, at: Date.now(), keys: imported };
  return imported;
}

export async function verifyAccessToken(
  supabaseUrl: string,
  token: string,
): Promise<{ id: string; email: string } | null | undefined> {
  const parts = token.split('.');
  if (parts.length !== 3) return undefined;
  let header: { alg?: string; kid?: string };
  let claims: Claims;
  try {
    header = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[0])));
    claims = JSON.parse(new TextDecoder().decode(base64UrlDecode(parts[1])));
  } catch {
    return undefined;
  }
  if (header.alg !== 'ES256' || !header.kid) return undefined;
  let keys = await signingKeys(supabaseUrl);
  // A key we haven't seen may have just been rotated in.
  if (!keys.has(header.kid)) keys = await signingKeys(supabaseUrl, true);
  const key = keys.get(header.kid);
  if (!key) return undefined;
  const valid = await crypto.subtle.verify(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    base64UrlDecode(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (
    !valid ||
    claims.iss !== `${supabaseUrl.replace(/\/$/, '')}/auth/v1` ||
    !audience.includes('authenticated') ||
    claims.role !== 'authenticated' ||
    typeof claims.exp !== 'number' ||
    claims.exp * 1000 <= Date.now() ||
    !claims.sub ||
    !claims.email
  )
    return null;
  return { id: claims.sub, email: claims.email };
}
