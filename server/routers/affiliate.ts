/**
 * Affiliate Router (Employee)
 * Handles: discount codes, commissions, payout requests, admin oversight.
 *
 * Access: employee (own data), admin (all data)
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router } from "../_core/trpc";
import { adminProcedure, employeeProcedure } from "./_guards";
import {
  createDiscountCodeForEmployee,
  createPayoutRequest,
  getAllCommissions,
  getAllDiscountCodes,
  getAllEmployeeEarnings,
  getAllPayoutRequests,
  getCommissionsByEmployeeId,
  getDiscountCodeByCode,
  getDiscountCodeByEmployeeId,
  getEmployeeEarningsSummary,
  getEmployees,
  getPayoutRequestById,
  getPayoutRequestsByEmployeeId,
  markCommissionsPaid,
  processPayoutRequest,
  updateDiscountCode,
} from "../db";
import { publicProcedure } from "../_core/trpc";

export const affiliateRouter = router({
  /** Returns (or creates) the employee's unique discount code */
  myCode: employeeProcedure.query(async ({ ctx }) => {
    let code = await getDiscountCodeByEmployeeId(ctx.user.id);
    if (!code) {
      code = await createDiscountCodeForEmployee(
        ctx.user.id,
        ctx.user.name ?? "EMP"
      );
    }
    return code;
  }),

  /** Returns the employee's earnings summary (total, pending, paid, referral count) */
  myEarnings: employeeProcedure.query(async ({ ctx }) =>
    getEmployeeEarningsSummary(ctx.user.id)
  ),

  /** Returns the employee's full commission history */
  myCommissions: employeeProcedure.query(async ({ ctx }) =>
    getCommissionsByEmployeeId(ctx.user.id)
  ),

  /**
   * Requests a payout for pending commissions.
   * Minimum payout: $10.00 (1000 cents)
   */
  requestPayout: employeeProcedure
    .input(
      z.object({
        amount: z.number().min(1000, "Minimum payout is $10.00"),
        paymentMethod: z.string().default("bank_transfer"),
        paymentDetails: z
          .object({
            bankName: z.string().optional(),
            accountLast4: z.string().optional(),
            routingNumber: z.string().optional(),
            paypalEmail: z.string().email().optional(),
            venmoHandle: z.string().optional(),
          })
          .optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const earnings = await getEmployeeEarningsSummary(ctx.user.id);
      if (earnings.pending < input.amount) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Insufficient pending balance. Available: $${(earnings.pending / 100).toFixed(2)}`,
        });
      }

      const result = await createPayoutRequest({
        employeeId: ctx.user.id,
        amount: input.amount,
        paymentMethod: input.paymentMethod,
        paymentDetails: input.paymentDetails,
      });
      return { success: true, payoutRequestId: (result as any).insertId };
    }),

  /** Returns the employee's payout request history */
  myPayouts: employeeProcedure.query(async ({ ctx }) =>
    getPayoutRequestsByEmployeeId(ctx.user.id)
  ),

  /**
   * Public: validates a discount code for checkout.
   * Returns validity and discount percentage.
   */
  validateCode: publicProcedure
    .input(z.object({ code: z.string().min(1) }))
    .query(async ({ input }) => {
      const code = await getDiscountCodeByCode(input.code);
      if (!code || !code.isActive) return { valid: false, discountPercent: 0 };
      if (code.maxUses && code.usageCount >= code.maxUses)
        return { valid: false, discountPercent: 0 };
      if (code.expiresAt && new Date(code.expiresAt) < new Date())
        return { valid: false, discountPercent: 0 };
      return { valid: true, discountPercent: code.discountPercent };
    }),

  // ─── Admin: Affiliate Oversight ──────────────────────────────────────────────

  /** Admin: returns all discount codes */
  adminAllCodes: adminProcedure.query(async () => getAllDiscountCodes()),

  /** Admin: returns all commissions */
  adminAllCommissions: adminProcedure.query(async () => getAllCommissions()),

  /** Admin: returns all payout requests */
  adminAllPayouts: adminProcedure.query(async () => getAllPayoutRequests()),

  /** Admin: updates a discount code (active status, discount %, max uses) */
  adminUpdateCode: adminProcedure
    .input(
      z.object({
        id: z.number(),
        isActive: z.boolean().optional(),
        discountPercent: z.number().min(1).max(100).optional(),
        maxUses: z.number().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateDiscountCode(id, data);
      return { success: true };
    }),

  /**
   * Admin: processes a payout request (complete or reject).
   * On completion: marks all pending commissions for the employee as paid.
   */
  adminProcessPayout: adminProcedure
    .input(
      z.object({
        payoutId: z.number(),
        action: z.enum(["completed", "rejected"]),
        rejectionReason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const payout = await getPayoutRequestById(input.payoutId);
      if (!payout) throw new TRPCError({ code: "NOT_FOUND" });
      if (payout.status !== "pending") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Payout already processed",
        });
      }

      if (input.action === "completed") {
        const commissions = await getCommissionsByEmployeeId(payout.employeeId);
        const pendingIds = commissions
          .filter(c => c.status === "pending")
          .map(c => c.id);
        if (pendingIds.length > 0) {
          await markCommissionsPaid(pendingIds);
        }
      }

      await processPayoutRequest(
        input.payoutId,
        ctx.user.id,
        input.action,
        input.rejectionReason
      );
      return { success: true };
    }),

  /**
   * Admin: returns performance summary for all employees.
   * Uses batched queries (3 total) to avoid N+1 problem.
   */
  adminEmployeePerformance: adminProcedure.query(async () => {
    const [employees, allCodes, allEarnings] = await Promise.all([
      getEmployees(),
      getAllDiscountCodes(),
      getAllEmployeeEarnings(),
    ]);

    const codesByEmployee = new Map(allCodes.map(c => [c.employeeId, c]));
    const earningsByEmployee = new Map(allEarnings.map(e => [e.employeeId, e]));

    return employees.map(emp => {
      const code = codesByEmployee.get(emp.id);
      const earnings = earningsByEmployee.get(emp.id);
      return {
        employeeId: emp.id,
        name: emp.name,
        email: emp.email,
        role: emp.role,
        discountCode: code?.code ?? null,
        codeActive: code?.isActive ?? false,
        usageCount: code?.usageCount ?? 0,
        totalEarned: earnings?.totalEarned ?? 0,
        pending: earnings?.pending ?? 0,
        paid: earnings?.paid ?? 0,
        referralCount: earnings?.referralCount ?? 0,
      };
    });
  }),
});
