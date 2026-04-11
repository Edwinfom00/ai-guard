/**
 * Collects all chunks from an AsyncIterable<string> into a single string.
 */
export async function collectAsyncIterable(stream: AsyncIterable<string>): Promise<string> {
  let result = '';
  for await (const chunk of stream) {
    result += chunk;
  }
  return result;
}

/**
 * Collects all chunks from a ReadableStream<string | Uint8Array> into a single string.
 */
export async function collectReadableStream(
  stream: ReadableStream<string | Uint8Array>
): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let result = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    result += typeof value === 'string' ? value : decoder.decode(value, { stream: true });
  }

  return result;
}

/**
 * Detects the stream type and collects all text.
 * Supports:
 *  - AsyncIterable<string>            (Vercel AI SDK, LangChain, Node streams)
 *  - ReadableStream<string|Uint8Array> (Web Streams API, Edge runtime)
 *  - { textStream: AsyncIterable<string> } (Vercel AI SDK streamText result shape)
 *  - { text: Promise<string> }         (Vercel AI SDK streamText result shape)
 */
export async function collectStream(
  stream: unknown
): Promise<string> {
  if (stream === null || stream === undefined) {
    throw new TypeError('Stream is null or undefined');
  }

  // Vercel AI SDK streamText result: has a `text` Promise — most efficient
  if (
    typeof stream === 'object' &&
    'text' in (stream as object) &&
    (stream as Record<string, unknown>)['text'] instanceof Promise
  ) {
    return (stream as { text: Promise<string> }).text;
  }

  // Vercel AI SDK: has textStream (AsyncIterable)
  if (
    typeof stream === 'object' &&
    'textStream' in (stream as object)
  ) {
    const textStream = (stream as { textStream: AsyncIterable<string> }).textStream;
    return collectAsyncIterable(textStream);
  }

  // AsyncIterable<string>
  if (typeof stream === 'object' && Symbol.asyncIterator in (stream as object)) {
    return collectAsyncIterable(stream as AsyncIterable<string>);
  }

  // ReadableStream
  if (typeof stream === 'object' && 'getReader' in (stream as object)) {
    return collectReadableStream(stream as ReadableStream<string | Uint8Array>);
  }

  // Plain string (passthrough — useful for testing)
  if (typeof stream === 'string') return stream;

  throw new TypeError(
    'Unsupported stream type. Expected AsyncIterable<string>, ReadableStream, or Vercel AI SDK streamText result.'
  );
}
