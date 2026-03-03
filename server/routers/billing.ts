/**
 * Billing Router
 * Handles: subscription management, paywall checks, Stripe checkout, payment history.
 *
 * Paywall states:
 *   - "free"           — first letter, no prior unlocked letters
 *   - "subscribed"     — active monthly/annual plan (bypass paywall entirely)
 *   - "pay_per_letter" — free letter already used, no active recurring subscription
 *
 * See: docs/skills/letter-review-pipeline/references/payment-flow.md
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { checkTrpcRateLimit } from "../rateLimiter";
import { protectedProcedure, router } from "../_core/trpc";
import { subscriberProcedure, getAppUrl } from "./_guards";
import {
  getLetterRequestSafeForSubscriber,
  logReviewAction,
  updateLetterStatus,
} from "../db";
import {
  sendLetterUnlockedEmail,
  sendNewReviewNeededEmail,
} from "../email";
import {
  checkLetterSubmissionAllowed,
  createBillingPortalSession,
  createCheckoutSession,
  createAttorneyReviewCheckout,
  createLetterUnlockCheckout,
  createTrialReviewCheckout,
  getOrCreateStripeCustomer,
  getStripe,
  getUserSubscription,
  hasActiveRecurringSubscription,
} from "../stripe";

export const billingRouter = router({
  /** Returns the current user's active subscription (if any) */
  getSubscription: protectedProcedure.query(async ({ ctx }) =>
    getUserSubscription(ctx.user.id)
  ),

  /** Checks whether the current user is allowed to submit a new letter */
  checkCanSubmit: protectedProcedure.query(async ({ ctx }) =>
    checkLetterSubmissionAllowed(ctx.user.id)
  ),

  /**
   * Returns the paywall state for the current subscriber:
   *   - "free"           — eligible for first free letter
   *   - "subscribed"     — active subscription, no paywall
   *   - "pay_per_letter" — must pay $200 to unlock
   */
  checkPaywallStatus: subscriberProcedure.query(async ({ ctx }) => {
    const isSubscribed = await hasActiveRecurringSubscription(ctx.user.id);
    if (isSubscribed) return { state: "subscribed" as const, eligible: false };

    const db = await (await import("../db")).getDb();
    if (!db) return { state: "pay_per_letter" as const, eligible: false };

    const { letterRequests } = await import("../../drizzle/schema");
    const { eq, and, notInArray } = await import("drizzle-orm");
    const unlockedLetters = await db
      .select({ id: letterRequests.id })
      .from(letterRequests)
      .where(
        and(
          eq(letterRequests.userId, ctx.user.id),
          notInArray(letterRequests.status, [
            "submitted",
            "researching",
            "drafting",
            "generated_locked",
          ])
        )
      );

    if (unlockedLetters.length === 0) return { state: "free" as const, eligible: true };
    return { state: "pay_per_letter" as const, eligible: false };
  }),

  /**
   * Legacy alias: kept for backward compatibility.
   * Use checkPaywallStatus for new code.
   */
  checkFirstLetterFree: subscriberProcedure.query(async ({ ctx }) => {
    const isSubscribed = await hasActiveRecurringSubscription(ctx.user.id);
    if (isSubscribed) return { eligible: false };

    const db = await (await import("../db")).getDb();
    if (!db) return { eligible: false };

    const { letterRequests } = await import("../../drizzle/schema");
    const { eq, and, notInArray } = await import("drizzle-orm");
    const paidLetters = await db
      .select({ id: letterRequests.id })
      .from(letterRequests)
      .where(
        and(
          eq(letterRequests.userId, ctx.user.id),
          notInArray(letterRequests.status, [
            "submitted",
            "researching",
            "drafting",
            "generated_locked",
          ])
        )
      );
    return { eligible: paidLetters.length === 0 };
  }),

  /**
   * Free unlock: transitions the first letter from generated_locked → pending_review.
   * Validates that the user has not already used their free letter.
   */
  freeUnlock: subscriberProcedure
    .input(z.object({ letterId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const letter = await getLetterRequestSafeForSubscriber(input.letterId, ctx.user.id);
      if (!letter) throw new TRPCError({ code: "NOT_FOUND", message: "Letter not found" });
      if (letter.status !== "generated_locked") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Letter is not in generated_locked status",
        });
      }

      // Verify free letter eligibility
      const db = await (await import("../db")).getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { letterRequests } = await import("../../drizzle/schema");
      const { eq: eqOp, and: andOp, notInArray: notInOp } = await import("drizzle-orm");
      const paidLetters = await db
        .select({ id: letterRequests.id })
        .from(letterRequests)
        .where(
          andOp(
            eqOp(letterRequests.userId, ctx.user.id),
            notInOp(letterRequests.status, [
              "submitted",
              "researching",
              "drafting",
              "generated_locked",
            ])
          )
        );

      if (paidLetters.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Free first letter has already been used.",
        });
      }

      await updateLetterStatus(input.letterId, "pending_review");
      await logReviewAction({
        letterRequestId: input.letterId,
        reviewerId: ctx.user.id,
        actorType: "subscriber",
        action: "free_unlock",
        noteText: "First letter — free attorney review (promotional)",
        noteVisibility: "internal",
        fromStatus: "generated_locked",
        toStatus: "pending_review",
      });

      try {
        const appUrl = getAppUrl(ctx.req);
        await sendLetterUnlockedEmail({
          to: ctx.user.email ?? "",
          name: ctx.user.name ?? "Subscriber",
          subject: letter.subject,
          letterId: input.letterId,
          appUrl,
        });
        await sendNewReviewNeededEmail({
          to: "",
          name: "Attorney Team",
          letterSubject: letter.subject,
          letterId: input.letterId,
          letterType: letter.letterType,
          jurisdiction: letter.jurisdictionState ?? "Unknown",
          appUrl,
        });
      } catch (e) {
        console.error("[freeUnlock] Email error:", e);
      }

      return { success: true, free: true };
    }),

  /**
   * Creates a Stripe checkout session for the $50 trial review (first letter).
   * Rate limited: 10 payment attempts per hour per user.
   */
  payTrialReview: subscriberProcedure
    .input(
      z.object({
        letterId: z.number(),
        discountCode: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await checkTrpcRateLimit("payment", `user:${ctx.user.id}`);

      const letter = await getLetterRequestSafeForSubscriber(input.letterId, ctx.user.id);
      if (!letter) throw new TRPCError({ code: "NOT_FOUND", message: "Letter not found" });
      if (letter.status !== "generated_locked" && letter.status !== "generated_unlocked") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Letter must be in generated_locked status to submit for review",
        });
      }

      const origin = getAppUrl(ctx.req);
      return createTrialReviewCheckout({
        userId: ctx.user.id,
        email: ctx.user.email ?? "",
        name: ctx.user.name,
        letterId: input.letterId,
        origin,
        discountCode: input.discountCode,
      });
    }),

  /**
   * Creates a Stripe checkout session for the $200 pay-per-letter unlock.
   * Rate limited: 10 payment attempts per hour per user.
   */
  payToUnlock: subscriberProcedure
    .input(
      z.object({
        letterId: z.number(),
        discountCode: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await checkTrpcRateLimit("payment", `user:${ctx.user.id}`);

      const letter = await getLetterRequestSafeForSubscriber(input.letterId, ctx.user.id);
      if (!letter) throw new TRPCError({ code: "NOT_FOUND", message: "Letter not found" });
      if (letter.status !== "generated_locked") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Letter is not in generated_locked status",
        });
      }

      const origin = getAppUrl(ctx.req);
      return createLetterUnlockCheckout({
        userId: ctx.user.id,
        email: ctx.user.email ?? "",
        name: ctx.user.name,
        letterId: input.letterId,
        origin,
        discountCode: input.discountCode,
      });
    }),

  /**
   * Creates a Stripe checkout session for a subscription plan.
   * Rate limited: 10 checkout attempts per hour per user.
   */
  createCheckout: protectedProcedure
    .input(
      z.object({
        planId: z.string(),
        discountCode: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await checkTrpcRateLimit("payment", `user:${ctx.user.id}`);

      const origin = getAppUrl(ctx.req);
      return createCheckoutSession({
        userId: ctx.user.id,
        email: ctx.user.email ?? "",
        name: ctx.user.name,
        planId: input.planId,
        origin,
        discountCode: input.discountCode,
      });
    }),

  /** Creates a Stripe billing portal session for subscription management */
  createBillingPortal: protectedProcedure.mutation(async ({ ctx }) => {
    const origin = getAppUrl(ctx.req);
    const url = await createBillingPortalSession({
      userId: ctx.user.id,
      email: ctx.user.email ?? "",
      origin,
    });
    return { url };
  }),

  /** Returns the last 25 payment intents for the current user from Stripe */
  paymentHistory: protectedProcedure.query(async ({ ctx }) => {
    const stripe = getStripe();
    try {
      const customerId = await getOrCreateStripeCustomer(
        ctx.user.id,
        ctx.user.email ?? "",
        ctx.user.name
      );
      const paymentIntents = await stripe.paymentIntents.list({
        customer: customerId,
        limit: 25,
        expand: ["data.latest_charge"],
      });
      return paymentIntents.data.map((pi: any) => ({
        id: pi.id,
        amount: pi.amount,
        currency: pi.currency,
        status: pi.status,
        description: pi.description ?? "Letter unlock payment",
        created: pi.created,
        receiptUrl: pi.latest_charge?.receipt_url ?? null,
        metadata: pi.metadata ?? {},
      }));
    } catch (e) {
      console.error("[paymentHistory] Stripe error:", e);
      return [];
    }
  }),

  /**
   * Creates a $100 Stripe Checkout session for the optional attorney review upsell.
   * Only valid when the letter is in generated_unlocked status (free trial).
   */
  payForAttorneyReview: subscriberProcedure
    .input(z.object({ letterId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await checkTrpcRateLimit("payment", `user:${ctx.user.id}`);
      const letter = await getLetterRequestSafeForSubscriber(input.letterId, ctx.user.id);
      if (!letter) throw new TRPCError({ code: "NOT_FOUND", message: "Letter not found" });
      if (letter.status !== "generated_unlocked") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Attorney review upsell is only available for free-trial letters (generated_unlocked)",
        });
      }
      const origin = getAppUrl(ctx.req);
      return createAttorneyReviewCheckout({
        userId: ctx.user.id,
        email: ctx.user.email ?? "",
        name: ctx.user.name,
        letterId: input.letterId,
        origin,
      });
    }),

  /** Returns the last 50 invoices for the current user from Stripe */
  receipts: subscriberProcedure.query(async ({ ctx }) => {
    const stripe = getStripe();
    try {
      const customerId = await getOrCreateStripeCustomer(
        ctx.user.id,
        ctx.user.email ?? "",
        ctx.user.name
      );
      const invoices = await stripe.invoices.list({ customer: customerId, limit: 50 });
      return {
        invoices: invoices.data.map((inv: any) => ({
          id: inv.id,
          date: inv.created,
          amount: inv.amount_paid,
          currency: inv.currency,
          status: inv.status,
          pdfUrl: inv.invoice_pdf ?? null,
          receiptUrl: inv.hosted_invoice_url ?? null,
          description: inv.lines?.data?.[0]?.description ?? "Payment",
        })),
      };
    } catch (e) {
      console.error("[receipts] Stripe error:", e);
      return { invoices: [] };
    }
  }),
});
