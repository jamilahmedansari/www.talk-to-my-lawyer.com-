/**
 * Letters Router (Subscriber)
 * Handles: letter submission, pipeline trigger, letter management, attachments.
 *
 * Status machine entry point: submitted → (pipeline) → generated_locked
 * See: docs/skills/letter-generation-pipeline/SKILL.md
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { checkTrpcRateLimit } from "../rateLimiter";
import { router } from "../_core/trpc";
import { subscriberProcedure, getAppUrl } from "./_guards";
import {
  createLetterRequest,
  createAttachment,
  getLetterRequestById,
  getLetterRequestSafeForSubscriber,
  getLetterRequestsByUserId,
  getLetterVersionsByRequestId,
  getReviewActions,
  getAttachmentsByLetterId,
  getAllUsers,
  logReviewAction,
  updateLetterStatus,
  archiveLetterRequest,
  createNotification,
} from "../db";
import {
  sendLetterSubmissionEmail,
  sendJobFailedAlertEmail,
} from "../email";
import { runFullPipeline, retryPipelineFromStage } from "../pipeline";
import { storagePut } from "../storage";

/** Intake form Zod schema — shared between submit and updateForChanges */
const intakeJsonSchema = z.object({
  schemaVersion: z.string().default("1.0"),
  letterType: z.string(),
  sender: z.object({
    name: z.string(),
    address: z.string(),
    email: z.string().optional(),
    phone: z.string().optional(),
  }),
  recipient: z.object({
    name: z.string(),
    address: z.string(),
    email: z.string().optional(),
    phone: z.string().optional(),
  }),
  jurisdiction: z.object({
    country: z.string(),
    state: z.string(),
    city: z.string().optional(),
  }),
  matter: z.object({
    category: z.string(),
    subject: z.string(),
    description: z.string(),
    incidentDate: z.string().optional(),
  }),
  financials: z
    .object({
      amountOwed: z.number().optional(),
      currency: z.string().optional(),
    })
    .optional(),
  desiredOutcome: z.string(),
  deadlineDate: z.string().optional(),
  additionalContext: z.string().optional(),
  tonePreference: z.enum(["firm", "moderate", "aggressive"]).optional(),
  language: z.string().optional(),
  priorCommunication: z.string().optional(),
  deliveryMethod: z.string().optional(),
  communications: z
    .object({
      summary: z.string(),
      lastContactDate: z.string().optional(),
      method: z.enum(["email", "phone", "letter", "in-person", "other"]).optional(),
    })
    .optional(),
  toneAndDelivery: z
    .object({
      tone: z.enum(["firm", "moderate", "aggressive"]),
      deliveryMethod: z.enum(["email", "certified-mail", "hand-delivery"]).optional(),
    })
    .optional(),
});

export const lettersRouter = router({
  /**
   * Submit a new letter request.
   * - Rate limited: 5 submissions/hour per user
   * - Triggers the 3-stage AI pipeline in background
   * - Sends submission confirmation email
   */
  submit: subscriberProcedure
    .input(
      z.object({
        letterType: z.enum([
          "demand-letter",
          "cease-and-desist",
          "contract-breach",
          "eviction-notice",
          "employment-dispute",
          "consumer-complaint",
          "general-legal",
        ]),
        subject: z.string().min(5).max(500),
        issueSummary: z.string().optional(),
        jurisdictionCountry: z.string().default("US"),
        jurisdictionState: z.string().min(2),
        jurisdictionCity: z.string().optional(),
        intakeJson: intakeJsonSchema,
        priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await checkTrpcRateLimit("letter", `user:${ctx.user.id}`);

      const result = await createLetterRequest({
        userId: ctx.user.id,
        letterType: input.letterType,
        subject: input.subject,
        issueSummary: input.issueSummary,
        jurisdictionCountry: input.jurisdictionCountry,
        jurisdictionState: input.jurisdictionState,
        jurisdictionCity: input.jurisdictionCity,
        intakeJson: input.intakeJson,
        priority: input.priority,
      });
      const letterId = (result as any)?.insertId;

      await logReviewAction({
        letterRequestId: letterId,
        reviewerId: ctx.user.id,
        actorType: "subscriber",
        action: "letter_submitted",
        fromStatus: undefined,
        toStatus: "submitted",
      });

      // Send submission confirmation email (non-blocking)
      const appUrl = getAppUrl(ctx.req);
      if (ctx.user.email) {
        sendLetterSubmissionEmail({
          to: ctx.user.email,
          name: ctx.user.name ?? "Subscriber",
          subject: input.subject,
          letterId,
          letterType: input.letterType,
          jurisdictionState: input.jurisdictionState,
          appUrl,
        }).catch((err) => console.error("[Email] Submission confirmation failed:", err));
      }

      // Trigger AI pipeline in background (non-blocking)
      runFullPipeline(letterId, input.intakeJson as any).catch(async (err) => {
        console.error("[Pipeline] Failed:", err);
        try {
          const admins = await getAllUsers("admin");
          for (const admin of admins) {
            if (admin.email) {
              await sendJobFailedAlertEmail({
                to: admin.email,
                name: admin.name ?? "Admin",
                letterId,
                jobType: "generation_pipeline",
                errorMessage: err instanceof Error ? err.message : String(err),
                appUrl,
              });
            }
            await createNotification({
              userId: admin.id,
              type: "job_failed",
              title: `Pipeline failed for letter #${letterId}`,
              body: err instanceof Error ? err.message : String(err),
              link: `/admin/jobs`,
            });
          }
        } catch (notifyErr) {
          console.error("[Pipeline] Failed to notify admins:", notifyErr);
        }
      });

      return { letterId, status: "submitted" };
    }),

  /** Returns all letters for the current subscriber */
  myLetters: subscriberProcedure.query(async ({ ctx }) => {
    return getLetterRequestsByUserId(ctx.user.id);
  }),

  /**
   * Returns full detail for a single letter (subscriber-safe view).
   * Includes: letter, review actions (user-visible only), versions, attachments.
   */
  detail: subscriberProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const letter = await getLetterRequestSafeForSubscriber(input.id, ctx.user.id);
      if (!letter) throw new TRPCError({ code: "NOT_FOUND", message: "Letter not found" });
      const actions = await getReviewActions(input.id, false);
      const versions = await getLetterVersionsByRequestId(input.id, false);
      const attachmentList = await getAttachmentsByLetterId(input.id);
      return { letter, actions, versions, attachments: attachmentList };
    }),

  /**
   * Subscriber responds to attorney's "request changes" with additional context.
   * Re-triggers the full AI pipeline after updating the intake JSON.
   */
  updateForChanges: subscriberProcedure
    .input(
      z.object({
        letterId: z.number(),
        additionalContext: z.string().min(10),
        updatedIntakeJson: z.any().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const letter = await getLetterRequestById(input.letterId);
      if (!letter || letter.userId !== ctx.user.id)
        throw new TRPCError({ code: "NOT_FOUND" });
      if (letter.status !== "needs_changes")
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Letter must be in needs_changes status",
        });

      await logReviewAction({
        letterRequestId: input.letterId,
        reviewerId: ctx.user.id,
        actorType: "subscriber",
        action: "subscriber_updated",
        noteText: input.additionalContext,
        noteVisibility: "user_visible",
        fromStatus: "needs_changes",
        toStatus: "submitted",
      });

      // Update intake JSON if provided
      if (input.updatedIntakeJson) {
        const db = await (await import("../db")).getDb();
        if (db) {
          const { letterRequests } = await import("../../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await db
            .update(letterRequests)
            .set({ intakeJson: input.updatedIntakeJson, updatedAt: new Date() } as any)
            .where(eq(letterRequests.id, input.letterId));
        }
      }

      // Transition back to submitted and re-run full pipeline
      await updateLetterStatus(input.letterId, "submitted");
      const intake = input.updatedIntakeJson ?? letter.intakeJson;
      if (intake) {
        const appUrl = getAppUrl(ctx.req);
        runFullPipeline(input.letterId, intake as any).catch(async (err) => {
          console.error("[Pipeline] Retry after subscriber update failed:", err);
          try {
            const admins = await getAllUsers("admin");
            for (const admin of admins) {
              if (admin.email) {
                await sendJobFailedAlertEmail({
                  to: admin.email,
                  name: admin.name ?? "Admin",
                  letterId: input.letterId,
                  jobType: "generation_pipeline",
                  errorMessage: err instanceof Error ? err.message : String(err),
                  appUrl,
                });
              }
            }
          } catch (notifyErr) {
            console.error("[Pipeline] Failed to notify admins:", notifyErr);
          }
        });
      }

      return { success: true };
    }),

  /**
   * Archives a completed (approved or rejected) letter.
   * Archived letters are hidden from the main list but remain in the database.
   */
  archive: subscriberProcedure
    .input(z.object({ letterId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const letter = await getLetterRequestById(input.letterId);
      if (!letter || letter.userId !== ctx.user.id)
        throw new TRPCError({ code: "NOT_FOUND" });
      if (!["approved", "rejected"].includes(letter.status))
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only completed letters can be archived",
        });
      await archiveLetterRequest(input.letterId, ctx.user.id);
      return { success: true };
    }),

  /**
   * Uploads a supporting document attachment for a letter.
   * File is stored in S3, metadata saved to database.
   */
  uploadAttachment: subscriberProcedure
    .input(
      z.object({
        letterId: z.number(),
        fileName: z.string(),
        mimeType: z.string(),
        base64Data: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const letter = await getLetterRequestById(input.letterId);
      if (!letter || letter.userId !== ctx.user.id)
        throw new TRPCError({ code: "NOT_FOUND" });

      const buffer = Buffer.from(input.base64Data, "base64");
      const key = `attachments/${ctx.user.id}/${input.letterId}/${Date.now()}-${input.fileName}`;
      const { url } = await storagePut(key, buffer, input.mimeType);

      await createAttachment({
        letterRequestId: input.letterId,
        uploadedByUserId: ctx.user.id,
        storagePath: key,
        storageUrl: url,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: buffer.length,
      });

      return { url, key };
    }),
});
