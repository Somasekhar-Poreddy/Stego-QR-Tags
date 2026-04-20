import app from "./app";
import { logger } from "./lib/logger";
import { ensureCommsSchema } from "./lib/migrations";
import { startPendingDisconnectFlusher } from "./services/commsRouter";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function main() {
  // Run idempotent comms-platform migrations before opening the port. We
  // intentionally do NOT block on this failing — the existing app routes
  // should keep working even if comms tables can't be created (e.g. perms).
  try {
    await ensureCommsSchema();
    startPendingDisconnectFlusher();
  } catch (err) {
    logger.error({ err }, "Comms schema bootstrap failed; comms features disabled");
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

void main();
