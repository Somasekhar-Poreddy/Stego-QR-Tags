import rateLimit from "express-rate-limit";

export const publicScanLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: true,
  message: { error: "Too many requests, please try again shortly." },
});
