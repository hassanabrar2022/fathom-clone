import { ApiError } from './database';
import type { IngestionEnv } from './ingestion';

/** AES-GCM for third-party tokens at rest. Output: base64(iv ‖ ciphertext). */
async function encryptionKey(env: IngestionEnv) {
  let raw: Uint8Array<ArrayBuffer>;
  try {
    raw = Uint8Array.from(atob(env.TOKEN_ENCRYPTION_KEY ?? ''), (character) =>
      character.charCodeAt(0),
    );
  } catch {
    raw = new Uint8Array();
  }
  if (raw.length !== 32)
    throw new ApiError(503, 'Calendar connections are not configured on this server.');
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ]);
}

function toBase64(bytes: Uint8Array) {
  let text = '';
  for (const byte of bytes) text += String.fromCharCode(byte);
  return btoa(text);
}

export async function seal(env: IngestionEnv, value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      await encryptionKey(env),
      new TextEncoder().encode(value),
    ),
  );
  const output = new Uint8Array(iv.length + sealed.length);
  output.set(iv);
  output.set(sealed, iv.length);
  return toBase64(output);
}

export async function unseal(env: IngestionEnv, value: string) {
  const bytes = Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: bytes.slice(0, 12) },
    await encryptionKey(env),
    bytes.slice(12),
  );
  return new TextDecoder().decode(plain);
}
