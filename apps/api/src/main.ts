import { buildApp } from "./app.js";
import { env } from "./env.js";

async function start(): Promise<void> {
  const app = buildApp();
  const port = env.PORT;

  try {
    await app.listen({ port, host: "0.0.0.0" });
    app.log.info(`API ready on http://0.0.0.0:${port}`);
  } catch (err) {
    app.log.error(err, "Failed to start API");
    process.exit(1);
  }
}

void start();
