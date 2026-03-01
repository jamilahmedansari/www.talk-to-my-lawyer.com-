/**
 * App Router — assembles all feature routers into a single tRPC router.
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
 */
import { router } from "../_core/trpc";
import { systemRouter } from "../_core/systemRouter";
import { authRouter } from "./auth";
import { lettersRouter } from "./letters";
import { reviewRouter } from "./review";
import { billingRouter } from "./billing";
import { adminRouter } from "./admin";
import { affiliateRouter } from "./affiliate";
import { notificationsRouter } from "./notifications";
import { versionsRouter } from "./versions";
import { profileRouter } from "./profile";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  letters: lettersRouter,
  review: reviewRouter,
  billing: billingRouter,
  admin: adminRouter,
  affiliate: affiliateRouter,
  notifications: notificationsRouter,
  versions: versionsRouter,
  profile: profileRouter,
});

export type AppRouter = typeof appRouter;
