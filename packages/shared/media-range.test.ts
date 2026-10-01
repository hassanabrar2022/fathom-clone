import { describe, expect, it } from 'vitest';
import worker from '../../apps/worker/src/index';
import {
  parseRange,
  PUBLIC_MEDIA_PATH,
} from '../../apps/worker/src/media-range';

describe('media ranges', () => {
  it('supports bounded, open-ended and suffix byte ranges', () => {
    expect(parseRange('bytes=2-4', 10)).toEqual({ start: 2, end: 4 });
    expect(parseRange('bytes=7-', 10)).toEqual({ start: 7, end: 9 });
    expect(parseRange('bytes=-3', 10)).toEqual({ start: 7, end: 9 });
    expect(parseRange('bytes=0-99', 10)).toEqual({ start: 0, end: 9 });
    expect(parseRange('bytes=50-', 10)).toBe('invalid');
    expect(parseRange('bytes=4-2', 10)).toBe('invalid');
    expect(parseRange('bytes=-0', 10)).toBe('invalid');
    expect(parseRange('bytes=0-1,3-4', 10)).toBeNull();
  });

  const env = {
    ASSETS: {
      async fetch() {
        return new Response(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]), {
          headers: { 'Content-Length': '10', ETag: '"demo"' },
        });
      },
    },
  };
  const request = (headers: Record<string, string> = {}, method = 'GET') =>
    new Request(`https://example.test${PUBLIC_MEDIA_PATH}`, {
      method,
      headers,
    });

  it('returns actual requested bytes and correct 206 headers', async () => {
    const response = await worker.fetch(request({ Range: 'bytes=2-4' }), env);
    expect(response.status).toBe(206);
    expect(response.headers.get('Content-Range')).toBe('bytes 2-4/10');
    expect(response.headers.get('Content-Length')).toBe('3');
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([
      2, 3, 4,
    ]);
  });
  it('derives bounds when the internal asset response omits Content-Length', async () => {
    const response = await worker.fetch(request({ Range: 'bytes=1-2' }), {
      ASSETS: {
        async fetch() {
          return new Response(new Uint8Array([4, 5, 6, 7]));
        },
      },
    });
    expect(response.status).toBe(206);
    expect(response.headers.get('Content-Range')).toBe('bytes 1-2/4');
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([5, 6]);
  });
  it('returns 416 for an unsatisfiable range and metadata for HEAD', async () => {
    expect(
      (await worker.fetch(request({ Range: 'bytes=99-' }), env)).status,
    ).toBe(416);
    const head = await worker.fetch(request({}, 'HEAD'), env);
    expect(head.status).toBe(200);
    expect(head.headers.get('Accept-Ranges')).toBe('bytes');
    expect(await head.text()).toBe('');
  });
  it('preserves full reads and rejects unsupported writes', async () => {
    expect((await worker.fetch(request(), env)).status).toBe(200);
    expect((await worker.fetch(request({}, 'POST'), env)).status).toBe(405);
    expect(
      (
        await worker.fetch(
          request({ Range: 'bytes=2-4', 'If-Range': '"stale"' }),
          env,
        )
      ).status,
    ).toBe(200);
  });
  it('returns a retryable response when asset access fails', async () => {
    const response = await worker.fetch(request(), {
      ASSETS: {
        async fetch(): Promise<Response> {
          throw new Error('Unavailable');
        },
      },
    });
    expect(response.status).toBe(503);
  });
});
