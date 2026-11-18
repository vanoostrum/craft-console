import { spawnSync } from "node:child_process";
import { expect, test } from "@playwright/test";

const start = (value: string) =>
  spawnSync("pnpm", ["start"], {
    env: { ...process.env, CONSOLE_DATA: value, PORT: "3199" },
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
