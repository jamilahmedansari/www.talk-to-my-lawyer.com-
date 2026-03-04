import "dotenv/config";
// Sentry must be initialized before other imports
import { initServerSentry, Sentry } from "../sentry";
initServerSentry();

import express from "express";
import { createServer } from "http";
import type { RequestHandler } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerSupabaseAuthRoutes } from "../supabaseAuth";
import { registerN8nCallbackRoute } from "../n8nCallback";
import { registerEmailPreviewRoute } from "../emailPreview";
import { registerDraftRemindersRoute } from "../draftReminders";
import { startCronScheduler } from "../cronScheduler";
import { stripeWebhookHandler } from "../stripeWebhook";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { getDb } from "../db";
import {
  authRateLimitMiddleware,
  generalRateLimitMiddleware,
} from "../rateLimiter";

async function startServer() {
  const app = express();
  const server = createServer(app);

  // ─── Health check (must be first, before CORS/auth) ────────────────────────
  app.get("/health", (_req, res) => {
    res.status(200).json({ status: "ok", ts: Date.now() });
  });

  const corsAllowlist = [
    process.env.APP_BASE_URL,
    process.env.ADMIN_APP_BASE_URL,
    process.env.STAGING_APP_BASE_URL,
    ...(process.env.CORS_ALLOWED_ORIGINS?.split(",") ?? []),
  ]
    .map(origin => origin?.trim())
    .filter((origin): origin is string => Boolean(origin));

  const wildcardConfigured = corsAllowlist.includes("*");
  if (wildcardConfigured) {
    throw new Error(
      "Invalid CORS configuration: wildcard '*' cannot be used when credentials are enabled. Use explicit origins in APP_BASE_URL/CORS_ALLOWED_ORIGINS instead."
    );
  }

  const allowedOrigins = new Set(corsAllowlist);
  const corsMiddleware: RequestHandler = (req, res, next) => {
    const requestOrigin = req.headers.origin;

    if (requestOrigin && allowedOrigins.has(requestOrigin)) {
      res.setHeader("Access-Control-Allow-Origin", requestOrigin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    }

    res.setHeader("Vary", "Origin");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS"
    );
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, X-Requested-With"
    );

    if (req.method === "OPTIONS") {
      if (requestOrigin && !allowedOrigins.has(requestOrigin)) {
        res.status(403).json({ error: "Origin not allowed by CORS policy" });
        return;
      }
      res.status(204).end();
      return;
    }

    next();
  };

  app.use(corsMiddleware);

  // ⚠️ Stripe webhook MUST be registered BEFORE express.json() to get raw body
  app.post(
    "/api/stripe/webhook",
    express.raw({ type: "application/json" }),
    stripeWebhookHandler
  );
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // ─── Rate Limiting ──────────────────────────────────────────────────────────
  // Auth endpoints: 10 req / 15 min per IP (protects against brute force)
  app.use("/api/auth/login", authRateLimitMiddleware);
  app.use("/api/auth/signup", authRateLimitMiddleware);
  app.use("/api/auth/forgot-password", authRateLimitMiddleware);
  // tRPC API: 60 req / 1 min per IP (broad abuse guard)
  app.use("/api/trpc", generalRateLimitMiddleware);
  // ───────────────────────────────────────────────────────────────────────────

  // Supabase Auth routes (signup, login, logout, refresh, forgot-password, reset-password)
  registerSupabaseAuthRoutes(app);
  // n8n pipeline callback endpoint
  registerN8nCallbackRoute(app);
  // Dev-only email template preview (disabled in production)
  registerEmailPreviewRoute(app);
  // Cron: 48-hour draft reminder emails for unpaid generated_locked letters
  registerDraftRemindersRoute(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // ─── Sentry Express error handler (must be before other error handlers) ───
  Sentry.setupExpressErrorHandler(app);

  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");

  server.listen(preferredPort, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${preferredPort}/`);
    // Warm up DB connection on startup so first request doesn't timeout
    getDb()
      .then(() => console.log("[Startup] Database connection warmed up"))
      .catch(() => {});
    // Start in-process cron scheduler (draft reminders, etc.)
    startCronScheduler();
  });
}

startServer().catch(console.error);
