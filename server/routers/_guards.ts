/**
 * Shared Role Guards & Utilities
 * Used by all feature routers to enforce role-based access control.
 */
import { TRPCError } from "@trpc/server";
import { protectedProcedure } from "../_core/trpc";
import {
  hasPolicyAccess,
  type RbacAction,
  type RbacResource,
} from "../_core/context";

// ─── Role Guards ──────────────────────────────────────────────────────────────

/**
 * Restricts access to employees and admins only.
 * Used for: affiliate system, commission management.
 */
function procedureFor(
  resource: RbacResource,
  action: RbacAction,
  message: string
) {
  return protectedProcedure.use(({ ctx, next }) => {
    if (!hasPolicyAccess(ctx.user.role, resource, action)) {
      throw new TRPCError({ code: "FORBIDDEN", message });
    }
    return next({ ctx });
  });
}

export const employeeProcedure = procedureFor(
  "affiliate",
  "write",
  "Employee or Admin access required"
);

/**
 * Restricts access to attorneys, employees, and admins.
 * Per architecture decision: employees are a subtype of attorney with elevated permissions.
 * Both attorney and employee roles can access the review queue and perform review actions.
 */
export const attorneyProcedure = procedureFor(
  "review",
  "write",
  "Attorney, Employee, or Admin access required"
);

/**
 * Restricts access to subscribers only.
 * Used for: letter submission, paywall, billing.
 */
export const subscriberProcedure = procedureFor(
  "letters",
  "write",
  "Subscriber access required"
);

export const adminProcedure = procedureFor(
  "admin",
  "manage",
  "Admin access required"
);

// ─── URL Helpers ──────────────────────────────────────────────────────────────

/**
 * Resolves the application base URL from request headers or environment.
 * Prefers the forwarded host header (for reverse proxy setups) over localhost.
 */
export function getAppUrl(req: {
  protocol: string;
  headers: Record<string, string | string[] | undefined>;
}): string {
  const host = req.headers["x-forwarded-host"] ?? req.headers.host;
  if (host && !String(host).includes("localhost")) {
    const proto = req.headers["x-forwarded-proto"] ?? req.protocol ?? "https";
    return `${proto}://${host}`;
  }
  return process.env.APP_BASE_URL ?? "https://www.talk-to-my-lawyer.com";
}
