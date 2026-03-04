/**
 * Admin Router
 * Handles: system stats, user management, letter oversight, pipeline job management.
 *
 * Access: admin role only (via centralized RBAC policy in _guards)
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../_core/trpc";
import { adminProcedure, getAppUrl } from "./_guards";
import {
  getAllLetterRequests,
  getAllUsers,
  getEmployees,
  getFailedJobs,
  getLetterRequestById,
  getLetterVersionsByRequestId,
  getReviewActions,
  getSystemStats,
  getWorkflowJobsByLetterId,
  getUserById,
  logReviewAction,
  purgeFailedJobs,
  updateLetterStatus,
  updateUserRole,
  createNotification,
} from "../db";
import { sendNewReviewNeededEmail } from "../email";
import { runFullPipeline, retryPipelineFromStage } from "../pipeline";

export const adminRouter = router({
  /** System-wide statistics for the admin dashboard */
  stats: adminProcedure.query(async () => getSystemStats()),

  /** Returns all users, optionally filtered by role */
  users: adminProcedure
    .input(
      z
        .object({
          role: z
            .enum(["subscriber", "employee", "admin", "attorney"])
            .optional(),
        })
        .optional()
    )
    .query(async ({ input }) => getAllUsers(input?.role)),

  /** Updates a user's role */
  updateRole: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        role: z.enum(["subscriber", "employee", "admin", "attorney"]),
      })
    )
    .mutation(async ({ input }) => {
      await updateUserRole(input.userId, input.role);
      return { success: true };
    }),

  /** Returns all letter requests, optionally filtered by status */
  allLetters: adminProcedure
    .input(z.object({ status: z.string().optional() }).optional())
    .query(async ({ input }) =>
      getAllLetterRequests({ status: input?.status })
    ),

  /** Returns all failed workflow jobs (up to 100) */
  failedJobs: adminProcedure.query(async () => getFailedJobs(100)),

  /**
   * Retries a specific pipeline stage for a letter.
   * Useful when a stage fails and needs to be re-run from a specific point.
   */
  retryJob: adminProcedure
    .input(
      z.object({
        letterId: z.number(),
        stage: z.enum(["research", "drafting"]),
      })
    )
    .mutation(async ({ input }) => {
      const letter = await getLetterRequestById(input.letterId);
      if (!letter) throw new TRPCError({ code: "NOT_FOUND" });
      if (!letter.intakeJson)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No intake data found",
        });

      retryPipelineFromStage(
        input.letterId,
        letter.intakeJson as any,
        input.stage
      ).catch(console.error);
      return {
        success: true,
        message: `Retry started for stage: ${input.stage}`,
      };
    }),

  /**
   * Triggers the full AI pipeline from scratch for a stuck letter.
   * Only allowed for letters in: submitted, researching, or drafting status.
   */
  triggerPipeline: adminProcedure
    .input(z.object({ letterId: z.number() }))
    .mutation(async ({ input }) => {
      const letter = await getLetterRequestById(input.letterId);
      if (!letter) throw new TRPCError({ code: "NOT_FOUND" });
      if (!letter.intakeJson) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No intake data found for this letter",
        });
      }

      const allowedStatuses = ["submitted", "researching", "drafting"];
      if (!allowedStatuses.includes(letter.status as string)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Cannot trigger pipeline for letter in status: ${letter.status}`,
        });
      }

      runFullPipeline(input.letterId, letter.intakeJson as any).catch(
        console.error
      );
      return {
        success: true,
        message: `Full pipeline triggered for letter #${input.letterId}`,
      };
    }),

  /** Purges all failed workflow jobs from the database */
  purgeFailedJobs: adminProcedure.mutation(async () => {
    const result = await purgeFailedJobs();
    return { success: true, deletedCount: result.deletedCount };
  }),

  /** Returns all workflow jobs for a specific letter */
  letterJobs: adminProcedure
    .input(z.object({ letterId: z.number() }))
    .query(async ({ input }) => getWorkflowJobsByLetterId(input.letterId)),

  /** Returns all employees */
  employees: adminProcedure.query(async () => getEmployees()),

  /**
   * Returns full letter detail for admin view.
   * Includes: letter, all versions (including internal), all review actions (including internal), workflow jobs.
   */
  getLetterDetail: adminProcedure
    .input(z.object({ letterId: z.number() }))
    .query(async ({ input }) => {
      const letter = await getLetterRequestById(input.letterId);
      if (!letter) throw new TRPCError({ code: "NOT_FOUND" });

      const [versions, actions, jobs] = await Promise.all([
        getLetterVersionsByRequestId(input.letterId, true),
        getReviewActions(input.letterId, true),
        getWorkflowJobsByLetterId(input.letterId),
      ]);

      const aiDraftVersion = versions.find(v => v.versionType === "ai_draft");
      return {
        ...letter,
        aiDraftContent: aiDraftVersion?.content ?? null,
        letterVersions: versions,
        reviewActions: actions,
        workflowJobs: jobs,
      };
    }),

  /**
   * Forces a status transition for any letter (admin override).
   * Bypasses the normal status machine — use with caution.
   * All forced transitions are logged with the admin's reason.
   */
  forceStatusTransition: adminProcedure
    .input(
      z.object({
        letterId: z.number(),
        newStatus: z.enum([
          "submitted",
          "researching",
          "drafting",
          "generated_locked",
          "pending_review",
          "under_review",
          "needs_changes",
          "approved",
          "rejected",
        ]),
        reason: z.string().min(5),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const letter = await getLetterRequestById(input.letterId);
      if (!letter) throw new TRPCError({ code: "NOT_FOUND" });

      await updateLetterStatus(input.letterId, input.newStatus);
      await logReviewAction({
        letterRequestId: input.letterId,
        reviewerId: ctx.user.id,
        actorType: "admin",
        action: "admin_force_status_transition",
        noteText: `Admin forced status from ${letter.status} to ${input.newStatus}. Reason: ${input.reason}`,
        noteVisibility: "internal",
        fromStatus: letter.status,
        toStatus: input.newStatus,
      });

      return { success: true };
    }),

  /**
   * Assigns a letter to a specific employee/attorney for review.
   * Notifies the assigned reviewer by email.
   */
  assignLetter: adminProcedure
    .input(z.object({ letterId: z.number(), employeeId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const letter = await getLetterRequestById(input.letterId);
      if (!letter) throw new TRPCError({ code: "NOT_FOUND" });

      await updateLetterStatus(input.letterId, letter.status, {
        assignedReviewerId: input.employeeId,
      });
      await logReviewAction({
        letterRequestId: input.letterId,
        reviewerId: ctx.user.id,
        actorType: "admin",
        action: "assigned_reviewer",
        noteText: `Assigned to employee ID ${input.employeeId}`,
        noteVisibility: "internal",
      });

      try {
        const appUrl = getAppUrl(ctx.req);
        const employee = await getUserById(input.employeeId);
        if (employee?.email) {
          await sendNewReviewNeededEmail({
            to: employee.email,
            name: employee.name ?? "Attorney",
            letterSubject: letter.subject,
            letterId: input.letterId,
            letterType: letter.letterType,
            jurisdiction: `${letter.jurisdictionState ?? ""}, ${letter.jurisdictionCountry ?? "US"}`,
            appUrl,
          });
        }
      } catch (err) {
        console.error("[Notify] Assign letter notification failed:", err);
      }

      return { success: true };
    }),
});
