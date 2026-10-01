import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyAccessToken } from '../../apps/worker/src/jwt';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const encode = (value: unknown) =>
  Buffer.from(typeof value === 'string' ? value : JSON.stringify(value))
    .toString('base64url');

async function signer() {
  const pair = (await crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair;
  const jwk = await crypto.subtle.exportKey('jwk', pair.publicKey);
  return {
    jwk: { ...jwk, kid: 'key-1', alg: 'ES256' },
    async sign(claims: Record<string, unknown>, kid = 'key-1', alg = 'ES256') {
      const body = `${encode({ alg, kid, typ: 'JWT' })}.${encode(claims)}`;
      const signature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        pair.privateKey,
        new TextEncoder().encode(body),
      );
      return `${body}.${Buffer.from(signature).toString('base64url')}`;
    },
  };
}

// The JWKS cache is per project URL, so each test uses its own.
let project = 0;
async function setup() {
  const url = `https://project-${++project}.supabase.example`;
  const key = await signer();
  const jwks = vi.fn<(url: string) => Promise<Response>>(async () =>
    Response.json({ keys: [key.jwk] }),
  );
  vi.stubGlobal('fetch', jwks);
  const claims = {
    sub: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    email: 'ada@example.com',
    iss: `${url}/auth/v1`,
    aud: 'authenticated',
    role: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + 600,
  };
  return { url, key, jwks, claims };
}

describe('local access token verification', () => {
  it('accepts a valid token and caches the signing keys', async () => {
    const { url, key, jwks, claims } = await setup();
    const token = await key.sign(claims);
    expect(await verifyAccessToken(url, token)).toEqual({
      id: claims.sub,
      email: claims.email,
    });
    await verifyAccessToken(url, token);
    expect(jwks).toHaveBeenCalledTimes(1);
    expect(String(jwks.mock.calls[0][0])).toBe(`${url}/auth/v1/.well-known/jwks.json`);
  });

  it.each([
    ['expired', { exp: Math.floor(Date.now() / 1000) - 1 }],
    ['issued by another project', { iss: 'https://other.example/auth/v1' }],
    ['not for signed-in users', { role: 'anon' }],
    ['without an audience', { aud: 'service' }],
  ])('rejects a token that is %s', async (_, change) => {
    const { url, key, claims } = await setup();
    expect(await verifyAccessToken(url, await key.sign({ ...claims, ...change }))).toBeNull();
  });

  it('rejects a token whose signature does not match', async () => {
    const { url, key, claims } = await setup();
    const token = await key.sign(claims);
    const [header, , signature] = token.split('.');
    const tampered = `${header}.${encode({ ...claims, sub: 'someone-else' })}.${signature}`;
    expect(await verifyAccessToken(url, tampered)).toBeNull();
  });

  it('defers to Supabase for unknown keys after refreshing them once', async () => {
    const { url, key, jwks, claims } = await setup();
    expect(await verifyAccessToken(url, await key.sign(claims, 'rotated'))).toBeUndefined();
    expect(jwks).toHaveBeenCalledTimes(2);
  });

  it('defers to Supabase for opaque or shared-secret tokens', async () => {
    const { url, key, jwks, claims } = await setup();
    expect(await verifyAccessToken(url, 'opaque-token')).toBeUndefined();
    expect(await verifyAccessToken(url, await key.sign(claims, 'key-1', 'HS256'))).toBeUndefined();
    expect(jwks).not.toHaveBeenCalled();
  });
});
