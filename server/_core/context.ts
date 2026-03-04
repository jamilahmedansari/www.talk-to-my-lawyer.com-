import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { authenticateRequest } from "../supabaseAuth";
import { setServerUser } from "../sentry";

export type AppRole = User["role"];
export type RbacResource =
  | "letters"
  | "billing"
  | "affiliate"
  | "review"
  | "admin"
  | "versions"
  | "notifications"
  | "profile";
export type RbacAction = "read" | "write" | "manage";

type RolePermissions = Record<
  AppRole,
  Partial<Record<RbacResource, readonly RbacAction[]>>
>;

export const ROLE_POLICY: RolePermissions = {
  subscriber: {
    letters: ["read", "write"],
    billing: ["read", "write"],
    versions: ["read"],
    notifications: ["read", "write"],
    profile: ["read", "write"],
  },
  employee: {
    affiliate: ["read", "write"],
    review: ["read", "write"],
    versions: ["read"],
    notifications: ["read", "write"],
    profile: ["read", "write"],
  },
  attorney: {
    review: ["read", "write"],
    versions: ["read"],
    notifications: ["read", "write"],
    profile: ["read", "write"],
  },
  admin: {
    letters: ["manage"],
    billing: ["manage"],
    affiliate: ["manage"],
    review: ["manage"],
    admin: ["manage"],
    versions: ["manage"],
    notifications: ["manage"],
    profile: ["manage"],
  },
};

export function hasPolicyAccess(
  role: AppRole,
  resource: RbacResource,
  action: RbacAction
): boolean {
  const allowedActions = ROLE_POLICY[role][resource] ?? [];
  return allowedActions.includes("manage") || allowedActions.includes(action);
}

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }

  // Set Sentry user context for this request scope
  if (user) {
    setServerUser({
      id: String(user.id),
      email: user.email ?? undefined,
      role: user.role ?? undefined,
    });
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
