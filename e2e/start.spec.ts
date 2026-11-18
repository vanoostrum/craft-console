import { spawn, spawnSync } from "node:child_process";
import { expect, test } from "@playwright/test";

const start = (value: string) =>
  spawnSync("pnpm", ["start"], {
    env: { ...process.env, CONSOLE_DATA: value, PORT: "3199" },
    encoding: "utf8",
    timeout: 30_000,
  });

test("pnpm start with CONSOLE_DATA=live starts the app", async () => {
  const child = spawn("pnpm", ["start"], {
    env: { ...process.env, CONSOLE_DATA: "live", PORT: "3198" },
    detached: true,
    stdio: "ignore",
  });
  try {
    let health = "";
    for (let i = 0; i < 120 && health !== "ok"; i++) {
      health = await fetch("http://127.0.0.1:3198/api/health")
        .then((response) => response.text())
        .catch(() => "");
      if (health !== "ok") await new Promise((done) => setTimeout(done, 250));
    }
    expect(health).toBe("ok");
  } finally {
    process.kill(-child.pid!, "SIGTERM");
  }
});

test("pnpm start with a wrong CONSOLE_DATA exits and names the allowed values", () => {
  const result = start("fixture");
  expect(result.status).not.toBe(0);
  expect(result.status).not.toBeNull();
  expect(result.stdout + result.stderr).toContain(
    'CONSOLE_DATA="fixture" is not a data source. Use fixtures or live.',
  );
});
