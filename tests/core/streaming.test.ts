import { describe, it, expect } from 'vitest';
import { Guardian } from '../../src/core/Guardian.js';
import { collectStream } from '../../src/utils/stream.js';

// Helper: build an AsyncIterable from an array of strings
async function* makeAsyncIterable(chunks: string[]): AsyncIterable<string> {
  for (const chunk of chunks) yield chunk;
}

describe('collectStream', () => {
  it('collects AsyncIterable<string>', async () => {
    const stream = makeAsyncIterable(['Hello', ' ', 'World']);
    expect(await collectStream(stream)).toBe('Hello World');
  });

  it('collects plain string passthrough', async () => {
    expect(await collectStream('just a string')).toBe('just a string');
  });

  it('collects Vercel AI SDK shape { text: Promise<string> }', async () => {
    const vercelShape = { text: Promise.resolve('vercel response') };
    expect(await collectStream(vercelShape)).toBe('vercel response');
  });

  it('collects { textStream: AsyncIterable<string> } shape', async () => {
    const shape = { textStream: makeAsyncIterable(['chunk1', 'chunk2']) };
    expect(await collectStream(shape)).toBe('chunk1chunk2');
  });

  it('throws on null', async () => {
    await expect(collectStream(null)).rejects.toThrow(TypeError);
  });
});

describe('Guardian.protectStream()', () => {
  it('collects stream and applies full pipeline', async () => {
    const guard = new Guardian({
      pii: { onInput: false, onOutput: true },
    });

    const result = await guard.protectStream(
      async () => makeAsyncIterable(['Contact: ', 'user@test.com', ' thanks']),
      'any prompt'
    );

    expect(result.raw).toContain('[REDACTED:EMAIL]');
    expect(result.raw).not.toContain('user@test.com');
  });

  it('validates schema after collecting stream', async () => {
    const validator = (data: unknown) => {
      const d = data as Record<string, unknown>;
      if (typeof d['city'] === 'string') return { success: true as const, data: d as { city: string } };
      return { success: false as const, error: 'missing city' };
    };

    const guard = new Guardian({ schema: { validator, repair: 'extract' } });

    // Stream delivers JSON split across chunks
    const result = await guard.protectStream(
      async () => makeAsyncIterable(['{"city"', ':"Paris"}'])
    );

    expect(result.data).toEqual({ city: 'Paris' });
  });

  it('works with Vercel AI SDK shape', async () => {
    const guard = new Guardian();
    const result = await guard.protectStream(
      async () => ({ text: Promise.resolve('hello from vercel') })
    );
    expect(result.raw).toBe('hello from vercel');
  });
});
