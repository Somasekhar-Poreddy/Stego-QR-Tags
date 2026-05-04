import app from "./app";
import { logger } from "./lib/logger";
import { ensureCommsSchema } from "./lib/migrations";
import { startPendingDisconnectFlusher } from "./services/commsRouter";
import { reconcileZavuTemplates } from "./services/zavuTemplateSync";

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
  // Set COMMS_MIGRATIONS=off in production where schema is managed by the
  // versioned supabase-comms-migration.sql file (applied via Supabase SQL
  // editor or `supabase db push`). Defaults to "auto" for local dev.
  const migrationsMode = (process.env.COMMS_MIGRATIONS ?? "auto").toLowerCase();
  try {
    if (migrationsMode !== "off") {
      await ensureCommsSchema();
    }
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

    // Reconcile Zavu templates after the server is up — runs in the
    // background so it doesn't block the port from accepting traffic.
    void reconcileZavuTemplates().catch((err) => {
      logger.warn({ err: err instanceof Error ? err.message : err }, "Zavu template sync failed (non-blocking)");
    });
  });
}

void main();
