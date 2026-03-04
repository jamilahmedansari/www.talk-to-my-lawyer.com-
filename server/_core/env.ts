export const ENV = {
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  // Supabase
  supabaseUrl: process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "",
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "",
  // AI Pipeline
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  perplexityApiKey: process.env.PERPLEXITY_API_KEY ?? "",
  // n8n Integration
  n8nWebhookUrl: process.env.N8N_WEBHOOK_URL ?? "",
  n8nCallbackSecret: process.env.N8N_CALLBACK_SECRET ?? "",
  // Email
  resendApiKey: process.env.RESEND_API_KEY ?? "",
  resendFromEmail: process.env.RESEND_FROM_EMAIL ?? "noreply@talktomylawyer.com",
  // Stripe
  stripeSecretKey: process.env.STRIPE_SECRET_KEY ?? "",
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? "",
  stripePublishableKey: process.env.VITE_STRIPE_PUBLISHABLE_KEY ?? "",
  // Upstash Redis (rate limiting)
  upstashRedisRestUrl: process.env.UPSTASH_REDIS_REST_URL ?? "",
  upstashRedisRestToken: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
  // Sentry
  sentryDsn: process.env.SENTRY_DSN ?? "",
  sentryOrg: process.env.SENTRY_ORG ?? "",
  sentryProject: process.env.SENTRY_PROJECT ?? "",
};
