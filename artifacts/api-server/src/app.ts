import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
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
app.use(cors());
// Capture the raw request body on every request so webhook routes can verify
// HMAC signatures over the exact bytes the provider signed. Without this, the
// global JSON parser would consume the body before route-level express.raw()
// could see it, leaving signature verification with no payload to hash.
declare module "express-serve-static-core" {
  interface Request {
    rawBody?: Buffer;
  }
}
const captureRawBody = (req: express.Request, _res: express.Response, buf: Buffer): void => {
  if (buf && buf.length > 0) req.rawBody = Buffer.from(buf);
};
app.use(express.json({ verify: captureRawBody, limit: "1mb" }));
app.use(express.urlencoded({ extended: true, verify: captureRawBody, limit: "1mb" }));

app.use("/api", router);

export default app;
