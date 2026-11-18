// `pnpm start`: check CONSOLE_DATA, then start the built app. A wrong value
// stops here with a non-zero status, before the server serves a request.
import { spawn } from "node:child_process";
// Node 22.18+ loads the .ts file with its built-in type stripping (see `engines`).
import { parseDataSource } from "../src/lib/console-data.ts";

try {
  parseDataSource(process.env.CONSOLE_DATA);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const child = spawn("next", ["start", ...process.argv.slice(2)], {
  stdio: "inherit",
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
