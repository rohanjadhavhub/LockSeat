import { buildApp } from "./app.ts";
import { env } from "./config/env.ts";

const app = buildApp({ logger: true });
await app.listen({ port: env.port, host: "0.0.0.0" });

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => app.close().then(() => process.exit(0)));
}
