import { describe, expect, it } from "vitest";
import { cachedRead, CACHE_MS } from "./cached-read";

/** A read that counts its calls, and answers with the call number or fails. */
function counter() {
  let calls = 0;
  let fail = false;
  return {
    get calls() {
      return calls;
    },
    failNext(value: boolean) {
      fail = value;
    },
    read: async () => {
      calls += 1;
      if (fail) throw new Error(`read ${calls} failed`);
      return calls;
    },
  };
}

function clock(start = 0) {
  let time = start;
  return {
    now: () => time,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

describe("cachedRead", () => {
  it("keeps a read for 5 minutes, with its read time", async () => {
    expect(CACHE_MS).toBe(5 * 60 * 1000);
    const source = counter();
    const time = clock(1_000);
    const read = cachedRead(source.read, time.now);

    expect(await read()).toEqual({ value: 1, readAt: 1_000 });
    time.advance(CACHE_MS - 1);
    expect(await read()).toEqual({ value: 1, readAt: 1_000 });
    expect(source.calls).toBe(1);

    time.advance(1);
    expect(await read()).toEqual({ value: 2, readAt: 1_000 + CACHE_MS });
    expect(source.calls).toBe(2);
  });

  it("fails after the cache expires when the new read fails, and the next call reads again", async () => {
    const source = counter();
    const time = clock();
    const read = cachedRead(source.read, time.now);
    await read();

    time.advance(CACHE_MS);
    source.failNext(true);
    await expect(read()).rejects.toThrow("read 2 failed");

    source.failNext(false);
    expect(await read()).toEqual({ value: 3, readAt: CACHE_MS });
    expect(source.calls).toBe(3);
  });

  it("does not keep a failed read", async () => {
    const source = counter();
    const read = cachedRead(source.read, clock().now);
    source.failNext(true);
    await expect(read()).rejects.toThrow("read 1 failed");
    await expect(read()).rejects.toThrow("read 2 failed");
    expect(source.calls).toBe(2);
  });

  it("shares one read between calls that come while it runs", async () => {
    const source = counter();
    const read = cachedRead(source.read, clock().now);
    const [a, b] = await Promise.all([read(), read()]);
    expect(a).toEqual(b);
    expect(source.calls).toBe(1);
  });
});
