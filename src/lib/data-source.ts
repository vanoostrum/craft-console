import { usableDataSource } from "./console-data";
import { fixtureReaders } from "./fixture-readers";
import type { Readers } from "./readers";

/**
 * The readers for `CONSOLE_DATA`. Each page request calls it, and the start
 * check in `scripts/start.mjs` checks the same value, so a wrong value never
 * shows fixture data.
 */
export function selectReaders(value: string | undefined): Readers {
  usableDataSource(value);
  return fixtureReaders;
}
