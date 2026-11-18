import { spawnSync } from "node:child_process";
import { expect, test } from "@playwright/test";

const start = (value: string, env: Record<string, string> = {}) =>
  spawnSync("pnpm", ["start"], {
    env: { ...process.env, CONSOLE_DATA: value, PORT: "3199", ...env },
    encoding: "utf8",
    timeout: 30_000,
  });

test("pnpm start with CONSOLE_DATA=live exits and says live data comes later", () => {
  const result = start("live");
  expect(result.status).not.toBe(0);
  expect(result.status).not.toBeNull();
  expect(result.stdout + result.stderr).toContain(
    "CONSOLE_DATA=live is not available yet: live data comes with the Live data ticket (CRAFT-63).",
  );
});

test("pnpm start with a wrong CONSOLE_DATA exits and names the allowed values", () => {
  const result = start("fixture");
  expect(result.status).not.toBe(0);
  expect(result.status).not.toBeNull();
  expect(result.stdout + result.stderr).toContain(
    'CONSOLE_DATA="fixture" is not a data source. Use fixtures or live.',
  );
});

for (const value of ["abc", "0", "-5"])
  test(`pnpm start with CONSOLE_MAX_PLAN_EUR=${value} exits and names the value`, () => {
    const result = start("fixtures", { CONSOLE_MAX_PLAN_EUR: value });
    expect(result.status).not.toBe(0);
    expect(result.status).not.toBeNull();
    expect(result.stdout + result.stderr).toContain(
      `CONSOLE_MAX_PLAN_EUR="${value}" is not a positive number of euros, such as 93 or 93.50.`,
    );
  });

test("pnpm start with a wrong CONSOLE_NOW exits and names the value", () => {
  const result = start("fixtures", { CONSOLE_NOW: "tomorrow" });
  expect(result.status).not.toBe(0);
  expect(result.status).not.toBeNull();
  expect(result.stdout + result.stderr).toContain(
    'CONSOLE_NOW="tomorrow" is not an ISO time, such as 2026-11-22T12:00:00Z.',
  );
});
