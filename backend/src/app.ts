import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import { existsSync } from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.set("trust proxy", true);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

const corsOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
app.use(
  cors(
    corsOrigins.length > 0
      ? { origin: corsOrigins, credentials: true }
      : undefined,
  ),
);
// Capture the raw request body on every request so webhook routes can verify
// HMAC signatures over the exact bytes the provider signed. Without this, the
// global JSON parser would consume the body before route-level express.raw()
// could see it, leaving signature verification with no payload to hash.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}
const captureRawBody = (req: express.Request, _res: express.Response, buf: Buffer): void => {
  if (buf && buf.length > 0) req.rawBody = Buffer.from(buf);
};
app.use(express.json({ verify: captureRawBody, limit: "1mb" }));
app.use(express.urlencoded({ extended: true, verify: captureRawBody, limit: "1mb" }));

app.use("/api", router);

const frontendDist = process.env.FRONTEND_DIST_PATH
  ?? path.resolve(import.meta.dirname, "..", "..", "frontend", "dist", "public");
if (process.env.SERVE_FRONTEND !== "false" && existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/webhooks")) return next();
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

export default app;
