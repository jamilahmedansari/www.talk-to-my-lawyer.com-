/**
 * Review Router (Attorney / Employee)
 * Handles: review queue, claim, save edits, approve, reject, request changes.
 *
 * Access: attorney, employee, admin roles
 * Status machine: pending_review → under_review → approved | rejected | needs_changes
 * See: docs/skills/letter-review-pipeline/SKILL.md
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../_core/trpc";
import { attorneyProcedure, getAppUrl } from "./_guards";
import {
  claimLetterForReview,
  createLetterVersion,
  getAllLetterRequests,
  getAttachmentsByLetterId,
  getLetterRequestById,
  getLetterVersionsByRequestId,
  getResearchRunsByLetterId,
  getReviewActions,
  getWorkflowJobsByLetterId,
  getUserById,
  logReviewAction,
  updateLetterStatus,
  updateLetterVersionPointers,
  updateLetterPdfUrl,
  createNotification,
} from "../db";
import {
  sendLetterApprovedEmail,
  sendLetterRejectedEmail,
  sendNeedsChangesEmail,
  sendReviewAssignedEmail,
  sendReviewCompletedEmail,
  sendStatusUpdateEmail,
} from "../email";
import { retryPipelineFromStage } from "../pipeline";
import { generateAndUploadApprovedPdf } from "../pdfGenerator";

export const reviewRouter = router({
  /**
   * Returns the review queue.
   * Supports filtering by status, unassigned letters, or letters assigned to the current user.
   */
  queue: attorneyProcedure
    .input(
      z
        .object({
          status: z.string().optional(),
          unassigned: z.boolean().optional(),
          myAssigned: z.boolean().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      if (input?.myAssigned) {
        return getAllLetterRequests({ assignedReviewerId: ctx.user.id });
      }
      return getAllLetterRequests({ status: input?.status, unassigned: input?.unassigned });
    }),

  /**
   * Returns full detail for a single letter (attorney view — includes internal notes).
   * Includes: letter, all versions, all review actions, workflow jobs, research runs, attachments.
   */
  letterDetail: attorneyProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const letter = await getLetterRequestById(input.id);
      if (!letter) throw new TRPCError({ code: "NOT_FOUND" });
      const versions = await getLetterVersionsByRequestId(input.id, true);
      const actions = await getReviewActions(input.id, true);
      const jobs = await getWorkflowJobsByLetterId(input.id);
      const research = await getResearchRunsByLetterId(input.id);
      const attachmentList = await getAttachmentsByLetterId(input.id);
      return { letter, versions, actions, jobs, research, attachments: attachmentList };
    }),

  /**
   * Claims a letter for review.
   * Transitions: pending_review | under_review → under_review
   * Notifies: subscriber (letter is being reviewed) + attorney (assignment confirmation)
   */
  claim: attorneyProcedure
    .input(z.object({ letterId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const letter = await getLetterRequestById(input.letterId);
      if (!letter) throw new TRPCError({ code: "NOT_FOUND" });
      if (!["pending_review", "under_review"].includes(letter.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Letter is not in a reviewable state",
        });
      }

      await claimLetterForReview(input.letterId, ctx.user.id);
      await logReviewAction({
        letterRequestId: input.letterId,
        reviewerId: ctx.user.id,
        actorType: ctx.user.role as any,
        action: "claimed_for_review",
        fromStatus: letter.status,
        toStatus: "under_review",
      });

      // Notify subscriber
      try {
        const subscriber = await getUserById(letter.userId);
        const appUrl = getAppUrl(ctx.req);
        if (subscriber?.email) {
          await sendStatusUpdateEmail({
            to: subscriber.email,
            name: subscriber.name ?? "Subscriber",
            subject: letter.subject,
            letterId: input.letterId,
            newStatus: "under_review",
            appUrl,
          });
        }
        await createNotification({
          userId: letter.userId,
          type: "letter_under_review",
          title: "Your letter is being reviewed",
          body: `An attorney has claimed your letter "${letter.subject}" and is currently reviewing it.`,
          link: `/letters/${input.letterId}`,
        });
      } catch (err) {
        console.error("[Notify] Claim subscriber notification failed:", err);
      }

      // Notify attorney (assignment confirmation)
      try {
        const attorney = await getUserById(ctx.user.id);
        const subscriber = await getUserById(letter.userId);
        const appUrl = getAppUrl(ctx.req);
        if (attorney?.email) {
          const jurisdiction =
            [letter.jurisdictionCity, letter.jurisdictionState, letter.jurisdictionCountry]
              .filter(Boolean)
              .join(", ") || "Not specified";
          await sendReviewAssignedEmail({
            to: attorney.email,
            name: attorney.name ?? "Attorney",
            letterSubject: letter.subject,
            letterId: input.letterId,
            letterType: letter.letterType,
            jurisdiction,
            subscriberName: subscriber?.name ?? "Subscriber",
            appUrl,
          });
        }
      } catch (err) {
        console.error("[Notify] Claim attorney notification failed:", err);
      }

      return { success: true };
    }),

  /**
   * Saves an attorney edit as a new version (does not change letter status).
   * Version type: attorney_edit
   */
  saveEdit: attorneyProcedure
    .input(
      z.object({
        letterId: z.number(),
        content: z.string().min(50),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const letter = await getLetterRequestById(input.letterId);
      if (!letter) throw new TRPCError({ code: "NOT_FOUND" });

      const version = await createLetterVersion({
        letterRequestId: input.letterId,
        versionType: "attorney_edit",
        content: input.content,
        createdByType: ctx.user.role as any,
        createdByUserId: ctx.user.id,
        metadataJson: { note: input.note },
      });
      await logReviewAction({
        letterRequestId: input.letterId,
        reviewerId: ctx.user.id,
        actorType: ctx.user.role as any,
        action: "attorney_edit_saved",
        noteText: input.note,
        noteVisibility: "internal",
      });

      return { versionId: (version as any)?.insertId };
    }),

  /**
   * Approves a letter and generates the final PDF.
   * Transitions: under_review → approved
   * Side effects:
   *   - Creates final_approved version
   *   - Generates PDF and uploads to S3
   *   - Notifies subscriber with PDF download link
   */
  approve: attorneyProcedure
    .input(
      z.object({
        letterId: z.number(),
        finalContent: z.string().min(50),
        internalNote: z.string().optional(),
        userVisibleNote: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const letter = await getLetterRequestById(input.letterId);
      if (!letter) throw new TRPCError({ code: "NOT_FOUND" });
      if (letter.status !== "under_review") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Letter must be under_review to approve",
        });
      }

      // Create final approved version
      const version = await createLetterVersion({
        letterRequestId: input.letterId,
        versionType: "final_approved",
        content: input.finalContent,
        createdByType: ctx.user.role as any,
        createdByUserId: ctx.user.id,
        metadataJson: {
          approvedBy: ctx.user.name,
          approvedAt: new Date().toISOString(),
        },
      });
      const versionId = (version as any)?.insertId;
      await updateLetterVersionPointers(input.letterId, { currentFinalVersionId: versionId });
      await updateLetterStatus(input.letterId, "approved");

      // Log review actions
      await logReviewAction({
        letterRequestId: input.letterId,
        reviewerId: ctx.user.id,
        actorType: ctx.user.role as any,
        action: "approved",
        noteText: input.internalNote,
        noteVisibility: "internal",
        fromStatus: "under_review",
        toStatus: "approved",
      });
      if (input.userVisibleNote) {
        await logReviewAction({
          letterRequestId: input.letterId,
          reviewerId: ctx.user.id,
          actorType: ctx.user.role as any,
          action: "attorney_note",
          noteText: input.userVisibleNote,
          noteVisibility: "user_visible",
        });
      }

      // Generate PDF, upload to Supabase private storage, store path (non-blocking on failure)
      let pdfStoragePath: string | undefined;
      try {
        const pdfResult = await generateAndUploadApprovedPdf({
          letterId: input.letterId,
          letterType: letter.letterType,
          subject: letter.subject,
          content: input.finalContent,
          approvedBy: ctx.user.name ?? undefined,
          approvedAt: new Date().toISOString(),
          jurisdictionState: letter.jurisdictionState,
          jurisdictionCountry: letter.jurisdictionCountry,
          intakeJson: letter.intakeJson as any,
        });
        pdfStoragePath = pdfResult.pdfKey;
        await updateLetterPdfUrl(input.letterId, pdfStoragePath);
        console.log(`[Approve] PDF stored at path: ${pdfStoragePath} for letter #${input.letterId}`);
      } catch (pdfErr) {
        console.error(`[Approve] PDF generation failed for letter #${input.letterId}:`, pdfErr);
        // Non-blocking: approval still succeeds even if PDF fails
      }

      // Notify subscriber — email directs to in-app download (no raw PDF URL exposed)
      try {
        const appUrl = getAppUrl(ctx.req);
        const subscriber = await getUserById(letter.userId);
        if (subscriber?.email) {
          await sendLetterApprovedEmail({
            to: subscriber.email,
            name: subscriber.name ?? "Subscriber",
            subject: letter.subject,
            letterId: input.letterId,
            appUrl,
            pdfUrl: undefined, // Subscriber downloads via secure signed URL in the app
          });
        }
        await createNotification({
          userId: letter.userId,
          type: "letter_approved",
          title: "Your letter has been approved!",
          body: `Your letter "${letter.subject}" is ready to download.${pdfStoragePath ? " A PDF copy is available in your account." : ""}`,
          link: `/letters/${input.letterId}`,
        });
        // Notify the reviewing attorney that their review is complete
        if (ctx.user.email) {
          const appUrl2 = getAppUrl(ctx.req);
          sendReviewCompletedEmail({
            to: ctx.user.email,
            name: ctx.user.name ?? "Attorney",
            letterSubject: letter.subject,
            letterId: input.letterId,
            action: "approved",
            appUrl: appUrl2,
          }).catch((e) => console.error("[Notify] Review completed email failed:", e));
        }
      } catch (err) {
        console.error("[Notify] Approve notification failed:", err);
      }

      return { success: true, versionId };
    }),

  /**
   * Rejects a letter.
   * Transitions: under_review → rejected
   * Notifies subscriber with the rejection reason.
   */
  reject: attorneyProcedure
    .input(
      z.object({
        letterId: z.number(),
        reason: z.string().min(10),
        userVisibleReason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const letter = await getLetterRequestById(input.letterId);
      if (!letter) throw new TRPCError({ code: "NOT_FOUND" });
      if (letter.status !== "under_review") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Letter must be under_review to reject",
        });
      }

      await updateLetterStatus(input.letterId, "rejected");
      await logReviewAction({
        letterRequestId: input.letterId,
        reviewerId: ctx.user.id,
        actorType: ctx.user.role as any,
        action: "rejected",
        noteText: input.reason,
        noteVisibility: "internal",
        fromStatus: "under_review",
        toStatus: "rejected",
      });

      const visibleReason = input.userVisibleReason ?? input.reason;
      await logReviewAction({
        letterRequestId: input.letterId,
        reviewerId: ctx.user.id,
        actorType: ctx.user.role as any,
        action: "rejection_notice",
        noteText: visibleReason,
        noteVisibility: "user_visible",
      });

      try {
        const appUrl = getAppUrl(ctx.req);
        const subscriber = await getUserById(letter.userId);
        if (subscriber?.email) {
          await sendLetterRejectedEmail({
            to: subscriber.email,
            name: subscriber.name ?? "Subscriber",
            subject: letter.subject,
            letterId: input.letterId,
            reason: visibleReason,
            appUrl,
          });
        }
        await createNotification({
          userId: letter.userId,
          type: "letter_rejected",
          title: "Update on your letter request",
          body: visibleReason,
          link: `/letters/${input.letterId}`,
        });
      } catch (err) {
        console.error("[Notify] Reject notification failed:", err);
      }

      return { success: true };
    }),

  /**
   * Requests changes from the subscriber.
   * Transitions: under_review → needs_changes
   * Optionally re-triggers the AI pipeline (drafting stage only).
   */
  requestChanges: attorneyProcedure
    .input(
      z.object({
        letterId: z.number(),
        internalNote: z.string().optional(),
        userVisibleNote: z.string().min(10),
        retriggerPipeline: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const letter = await getLetterRequestById(input.letterId);
      if (!letter) throw new TRPCError({ code: "NOT_FOUND" });
      if (letter.status !== "under_review") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Letter must be under_review" });
      }

      await updateLetterStatus(input.letterId, "needs_changes");
      await logReviewAction({
        letterRequestId: input.letterId,
        reviewerId: ctx.user.id,
        actorType: ctx.user.role as any,
        action: "requested_changes",
        noteText: input.internalNote,
        noteVisibility: "internal",
        fromStatus: "under_review",
        toStatus: "needs_changes",
      });
      await logReviewAction({
        letterRequestId: input.letterId,
        reviewerId: ctx.user.id,
        actorType: ctx.user.role as any,
        action: "changes_requested",
        noteText: input.userVisibleNote,
        noteVisibility: "user_visible",
      });

      try {
        const appUrl = getAppUrl(ctx.req);
        const subscriber = await getUserById(letter.userId);
        if (subscriber?.email) {
          await sendNeedsChangesEmail({
            to: subscriber.email,
            name: subscriber.name ?? "Subscriber",
            subject: letter.subject,
            letterId: input.letterId,
            attorneyNote: input.userVisibleNote,
            appUrl,
          });
        }
        await createNotification({
          userId: letter.userId,
          type: "needs_changes",
          title: "Changes requested for your letter",
          body: input.userVisibleNote,
          link: `/letters/${input.letterId}`,
        });
      } catch (err) {
        console.error("[Notify] RequestChanges notification failed:", err);
      }

      // Optionally re-trigger pipeline from drafting stage
      if (input.retriggerPipeline && letter.intakeJson) {
        retryPipelineFromStage(input.letterId, letter.intakeJson as any, "drafting").catch(
          console.error
        );
      }

      return { success: true };
    }),
});
