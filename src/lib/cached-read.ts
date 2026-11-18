/** How long a successful read is kept: 5 minutes. */
export const CACHE_MS = 5 * 60 * 1000;

export type Cached<T> = { value: T; readAt: number };

/**
 * Keep the result of `read` for `CACHE_MS`, with the time it was read. A failed
 * read is not kept: the next call reads again. Calls that come while a read runs
 * share it.
 */
export function cachedRead<T>(
  read: () => Promise<T>,
  now: () => number = Date.now,
): () => Promise<Cached<T>> {
  let kept: Cached<T> | undefined;
  let running: Promise<Cached<T>> | undefined;
  return () => {
    if (kept && now() - kept.readAt < CACHE_MS) return Promise.resolve(kept);
    running ??= (async () => {
      const readAt = now();
      try {
        kept = { value: await read(), readAt };
        return kept;
      } finally {
        running = undefined;
      }
    })();
    return running;
  };
}
