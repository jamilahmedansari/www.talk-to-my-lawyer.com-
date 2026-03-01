/**
 * Server Router Entry Point
 *
 * This file is the single import point for the tRPC app router.
 * All procedures are organized into feature modules under server/routers/.
 *
 * Feature modules:
 *   auth          — session management, onboarding
 *   letters       — subscriber letter submission and management
 *   review        — attorney/employee review center
 *   billing       — Stripe payments, paywall, subscriptions
 *   admin         — system administration
 *   affiliate     — employee discount codes and commissions
 *   notifications — in-app notifications
 *   versions      — letter version access (role-gated)
 *   profile       — user profile and account settings
 *
 * @see server/routers/index.ts for the assembled router
 * @see server/routers/*.ts for individual feature modules
 */
export { appRouter } from "./routers/index";
export type { AppRouter } from "./routers/index";
