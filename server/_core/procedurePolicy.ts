/**
 * Centralized Procedure Policy Map
 *
 * Single source of truth for authorization across all tRPC procedures.
 * Maps every procedure key to its auth mode, allowed roles, and dynamic requirements.
 *
 * Usage:
 *   1. One-liner at the start of a resolver:
 *        enforceProcedure(ctx, "letters.submit");
 *
 *   2. With resource-level checks (after fetching the resource):
 *        enforceProcedure(ctx, "letters.detail", { ownerUserId: letter.userId });
 *
 *   3. Via policyProcedure() wrapper in trpc.ts (auto-enforces auth + role):
 *        submit: policyProcedure("letters.submit").input(...).mutation(...)
 */
import { TRPCError } from "@trpc/server";
import type { LetterStatus, VersionType } from "../../drizzle/schema";

// Re-export the Role type aligned to USER_ROLES in drizzle/schema.ts
export type Role = "subscriber" | "employee" | "attorney" | "admin";

/** Exact procedure keys as they appear in server/routers/index.ts */
export type ProcedureKey =
  // system
  | "system.health"
  // auth
  | "auth.me"
  | "auth.logout"
  // letters (subscriber)
  | "letters.submit"
  | "letters.myLetters"
  | "letters.detail"
  | "letters.updateForChanges"
  | "letters.uploadAttachment"
  // review (employee/attorney/admin)
  | "review.queue"
  | "review.letterDetail"
  | "review.claim"
  | "review.approve"
  | "review.reject"
  | "review.requestChanges"
  | "review.saveEdit"
  // admin
  | "admin.stats"
  | "admin.users"
  | "admin.updateRole"
  | "admin.allLetters"
  | "admin.failedJobs"
  | "admin.retryJob"
  | "admin.letterJobs"
  | "admin.employees"
  | "admin.getLetterDetail"
  | "admin.forceStatusTransition"
  | "admin.assignLetter"
  // affiliate (employee + admin)
  | "affiliate.myCode"
  | "affiliate.myEarnings"
  | "affiliate.myCommissions"
  | "affiliate.requestPayout"
  | "affiliate.myPayouts"
  | "affiliate.validateCode"
  | "affiliate.adminAllCodes"
  | "affiliate.adminAllCommissions"
  | "affiliate.adminAllPayouts"
  | "affiliate.adminUpdateCode"
  | "affiliate.adminProcessPayout"
  | "affiliate.adminEmployeePerformance"
  // notifications
  | "notifications.list"
  | "notifications.markRead"
  | "notifications.markAllRead"
  // versions
  | "versions.get"
  // billing
  | "billing.getSubscription"
  | "billing.checkCanSubmit"
  | "billing.createCheckout"
  | "billing.createBillingPortal"
  | "billing.payToUnlock"
  // profile
  | "profile.updateProfile"
  | "profile.changeEmail"
  | "profile.changePassword";

type Policy = {
  auth: "public" | "protected";
  roles?: readonly Role[];
  /**
   * Optional dynamic checks after you've fetched the resource (letter/version).
   * Keep these centralized so you don't sprinkle logic everywhere.
   */
  requires?: {
    ownerUserId?: true;
    letterStatusIn?: readonly LetterStatus[];
    versionTypeForSubscriberIn?: readonly VersionType[];
  };
  note?: string;
};

const ALL_ROLES: readonly Role[] = ["subscriber", "employee", "attorney", "admin"] as const;

export const PROCEDURE_POLICY: Record<ProcedureKey, Policy> = {
  // ── System ──────────────────────────────────────────────────────────────────
  "system.health": { auth: "public", note: "Health check" },

  // ── Auth ────────────────────────────────────────────────────────────────────
  "auth.me": { auth: "public", note: "Returns ctx.user if present" },
  "auth.logout": { auth: "public", note: "Clears session cookie" },

  // ── Subscriber Letters ──────────────────────────────────────────────────────
  "letters.submit": {
    auth: "protected",
    roles: ["subscriber"],
    note: "Create letter request + trigger pipeline",
  },
  "letters.myLetters": {
    auth: "protected",
    roles: ["subscriber"],
    note: "List own letter requests",
  },
  "letters.detail": {
    auth: "protected",
    roles: ["subscriber"],
    requires: { ownerUserId: true },
    note: "Subscriber-safe detail; must own letter",
  },
  "letters.updateForChanges": {
    auth: "protected",
    roles: ["subscriber"],
    requires: { ownerUserId: true, letterStatusIn: ["needs_changes"] },
    note: "Only own letter; only when needs_changes",
  },
  "letters.uploadAttachment": {
    auth: "protected",
    roles: ["subscriber"],
    requires: { ownerUserId: true },
    note: "Only own letter",
  },

  // ── Review Centre ───────────────────────────────────────────────────────────
  // NOTE: employee + attorney + admin matches the existing attorneyProcedure behavior.
  "review.queue": {
    auth: "protected",
    roles: ["employee", "attorney", "admin"],
    note: "Queue view (scoped by query)",
  },
  "review.letterDetail": {
    auth: "protected",
    roles: ["employee", "attorney", "admin"],
    note: "Internal detail view",
  },
  "review.claim": {
    auth: "protected",
    roles: ["employee", "attorney", "admin"],
    requires: { letterStatusIn: ["pending_review", "under_review"] },
    note: "Claim should move pending_review → under_review",
  },
  "review.approve": {
    auth: "protected",
    roles: ["employee", "attorney", "admin"],
    requires: { letterStatusIn: ["under_review"] },
    note: "Approve only when under_review",
  },
  "review.reject": {
    auth: "protected",
    roles: ["employee", "attorney", "admin"],
    requires: { letterStatusIn: ["under_review"] },
    note: "Reject only when under_review",
  },
  "review.requestChanges": {
    auth: "protected",
    roles: ["employee", "attorney", "admin"],
    requires: { letterStatusIn: ["under_review"] },
    note: "Needs changes only when under_review",
  },
  "review.saveEdit": {
    auth: "protected",
    roles: ["employee", "attorney", "admin"],
    note: "Attorney/employee edit version save",
  },

  // ── Admin ───────────────────────────────────────────────────────────────────
  "admin.stats": { auth: "protected", roles: ["admin"] },
  "admin.users": { auth: "protected", roles: ["admin"] },
  "admin.updateRole": { auth: "protected", roles: ["admin"] },
  "admin.allLetters": { auth: "protected", roles: ["admin"] },
  "admin.failedJobs": { auth: "protected", roles: ["admin"] },
  "admin.retryJob": { auth: "protected", roles: ["admin"] },
  "admin.letterJobs": { auth: "protected", roles: ["admin"] },
  "admin.employees": { auth: "protected", roles: ["admin"] },
  "admin.getLetterDetail": { auth: "protected", roles: ["admin"] },
  "admin.forceStatusTransition": { auth: "protected", roles: ["admin"] },
  "admin.assignLetter": { auth: "protected", roles: ["admin"] },

  // ── Affiliate ───────────────────────────────────────────────────────────────
  "affiliate.myCode": {
    auth: "protected",
    roles: ["employee", "admin"],
    note: "Returns (or creates) employee discount code",
  },
  "affiliate.myEarnings": {
    auth: "protected",
    roles: ["employee", "admin"],
    note: "Employee earnings summary",
  },
  "affiliate.myCommissions": {
    auth: "protected",
    roles: ["employee", "admin"],
    note: "Employee commission history",
  },
  "affiliate.requestPayout": {
    auth: "protected",
    roles: ["employee", "admin"],
    note: "Request payout for pending commissions",
  },
  "affiliate.myPayouts": {
    auth: "protected",
    roles: ["employee", "admin"],
    note: "Employee payout history",
  },
  "affiliate.validateCode": {
    auth: "public",
    note: "Public: validates a discount code for checkout",
  },
  "affiliate.adminAllCodes": { auth: "protected", roles: ["admin"] },
  "affiliate.adminAllCommissions": { auth: "protected", roles: ["admin"] },
  "affiliate.adminAllPayouts": { auth: "protected", roles: ["admin"] },
  "affiliate.adminUpdateCode": { auth: "protected", roles: ["admin"] },
  "affiliate.adminProcessPayout": { auth: "protected", roles: ["admin"] },
  "affiliate.adminEmployeePerformance": { auth: "protected", roles: ["admin"] },

  // ── Notifications (any authenticated user) ──────────────────────────────────
  "notifications.list": { auth: "protected", roles: ALL_ROLES },
  "notifications.markRead": { auth: "protected", roles: ALL_ROLES },
  "notifications.markAllRead": { auth: "protected", roles: ALL_ROLES },

  // ── Versions ────────────────────────────────────────────────────────────────
  "versions.get": {
    auth: "protected",
    roles: ALL_ROLES,
    requires: { versionTypeForSubscriberIn: ["final_approved"] },
    note: "Subscriber can only fetch final_approved versions",
  },

  // ── Billing ─────────────────────────────────────────────────────────────────
  "billing.getSubscription": { auth: "protected", roles: ALL_ROLES },
  "billing.checkCanSubmit": { auth: "protected", roles: ALL_ROLES },
  "billing.createCheckout": { auth: "protected", roles: ALL_ROLES },
  "billing.createBillingPortal": { auth: "protected", roles: ALL_ROLES },
  "billing.payToUnlock": {
    auth: "protected",
    roles: ["subscriber"],
    requires: { ownerUserId: true, letterStatusIn: ["generated_locked"] },
    note: "Legacy $29 unlock; will be replaced by free-trial + $100 upsell flow",
  },

  // ── Profile ─────────────────────────────────────────────────────────────────
  "profile.updateProfile": { auth: "protected", roles: ALL_ROLES },
  "profile.changeEmail": { auth: "protected", roles: ALL_ROLES },
  "profile.changePassword": { auth: "protected", roles: ALL_ROLES },
};

// ── Runtime Enforcement ─────────────────────────────────────────────────────

export type EnforceArgs = {
  /** When the procedure requires ownership checks, pass the resource owner's user ID. */
  ownerUserId?: number;
  /** When the procedure requires letter status checks, pass the current status. */
  letterStatus?: LetterStatus;
  /** When the procedure requires version type checks, pass the versionType. */
  versionType?: VersionType;
};

/**
 * Enforce the policy for a given procedure key.
 *
 * Call with just (ctx, key) for auth + role checks.
 * Call with (ctx, key, { ownerUserId, letterStatus, ... }) for resource-level checks.
 */
export function enforceProcedure(
  ctx: { user: { id: number; role: string } | null },
  key: ProcedureKey,
  args: EnforceArgs = {},
) {
  const policy = PROCEDURE_POLICY[key];
  if (!policy) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `Missing policy for ${key}` });
  }

  // Auth check
  if (policy.auth === "protected" && !ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Authentication required" });
  }

  // Role check
  if (policy.roles?.length) {
    const role = (ctx.user?.role ?? null) as Role | null;
    if (!role || !policy.roles.includes(role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: `Forbidden: ${key}` });
    }
  }

  const req = policy.requires;
  if (!req) return;

  // Ownership requirement (subscriber endpoints)
  if (req.ownerUserId) {
    if (typeof args.ownerUserId !== "number") {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Policy ${key} requires ownerUserId`,
      });
    }
    if (!ctx.user || ctx.user.id !== args.ownerUserId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not owner" });
    }
  }

  // Status requirement (review transitions / unlock)
  if (req.letterStatusIn) {
    if (!args.letterStatus) {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Policy ${key} requires letterStatus`,
      });
    }
    if (!req.letterStatusIn.includes(args.letterStatus)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Invalid status for ${key}: ${args.letterStatus}`,
      });
    }
  }

  // Version access restriction for subscribers
  if (req.versionTypeForSubscriberIn) {
    const role = (ctx.user?.role ?? null) as Role | null;
    if (role === "subscriber") {
      if (!args.versionType) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Policy ${key} requires versionType`,
        });
      }
      if (!req.versionTypeForSubscriberIn.includes(args.versionType)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
    }
  }
}
