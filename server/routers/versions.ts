/**
 * Versions Router
 * Handles: accessing letter versions with role-based visibility rules.
 *
 * Subscriber access rules:
 *   - final_approved: always accessible
 *   - ai_draft: accessible only when letter is in generated_locked (paywall preview)
 *   - attorney_edit: not accessible
 *
 * Attorney/admin: all versions accessible
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getLetterRequestById, getLetterVersionById } from "../db";

export const versionsRouter = router({
  /** Returns a letter version by ID, enforcing role-based visibility rules */
  get: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const version = await getLetterVersionById(input.id);
      if (!version) throw new TRPCError({ code: "NOT_FOUND" });

      if (ctx.user.role === "subscriber") {
        // Subscribers can always view final_approved versions
        if (version.versionType === "final_approved") return version;

        // Subscribers can view ai_draft when the letter is in generated_locked (paywall preview)
        if (version.versionType === "ai_draft") {
          const letter = await getLetterRequestById(version.letterRequestId);
          if (
            letter &&
            letter.userId === ctx.user.id &&
            letter.status === "generated_locked"
          ) {
            return version;
          }
        }

        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }

      // Attorneys, employees, and admins can access all versions
      return version;
    }),
});
