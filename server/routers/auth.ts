/**
 * Auth Router
 * Handles: session management, onboarding, role assignment
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { updateUserRole, createDiscountCodeForEmployee } from "../db";

export const authRouter = router({
  /** Returns the current authenticated user (null if not logged in) */
  me: publicProcedure.query((opts) => opts.ctx.user),

  /** Clears all session cookies and logs the user out */
  logout: publicProcedure.mutation(({ ctx }) => {
    const cookieOptions = getSessionCookieOptions(ctx.req);
    ctx.res.clearCookie("sb_session", { ...cookieOptions, maxAge: -1 });
    ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
    return { success: true } as const;
  }),

  /**
   * Completes the post-signup onboarding step.
   * Sets the user's role and performs role-specific setup:
   * - employee: auto-generates a unique affiliate discount code
   */
  completeOnboarding: protectedProcedure
    .input(
      z.object({
        role: z.enum(["subscriber", "employee", "attorney"]),
        jurisdiction: z.string().optional(),
        barNumber: z.string().optional(),
        companyName: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      await updateUserRole(userId, input.role);

      if (input.role === "employee") {
        try {
          await createDiscountCodeForEmployee(userId, ctx.user.name || "affiliate");
        } catch (e) {
          // Discount code may already exist if user re-onboards
          console.log("[Onboarding] Discount code creation skipped (may already exist)", e);
        }
      }

      const roleMessages: Record<string, string> = {
        subscriber: "Your account is ready. Start submitting legal letters!",
        employee: "Your affiliate account is set up with a unique discount code.",
        attorney: "Your attorney profile is ready. Head to the Review Center.",
      };

      return {
        success: true,
        role: input.role,
        message: roleMessages[input.role] ?? "Account set up!",
      };
    }),
});
