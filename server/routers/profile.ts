/**
 * Profile Router
 * Handles: profile updates, email changes, password changes.
 *
 * Access: all authenticated users
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createEmailVerificationToken,
  deleteUserVerificationTokens,
  getUserByEmail,
  updateUserProfile,
} from "../db";
import { sendVerificationEmail } from "../email";
import { getAppUrl } from "./_guards";

export const profileRouter = router({
  /** Updates the current user's display name or email */
  updateProfile: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(200).optional(),
        email: z.string().email().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await updateUserProfile(ctx.user.id, input);
      return { success: true };
    }),

  /**
   * Changes the user's email address.
   * - Verifies current password before allowing change
   * - Updates email in Supabase Auth and app database
   * - Sends verification email to new address
   * - Sets emailVerified = false until new email is verified
   */
  changeEmail: protectedProcedure
    .input(
      z.object({
        newEmail: z.string().email("Please enter a valid email address"),
        currentPassword: z.string().min(1, "Password is required to change email"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { createClient } = await import("@supabase/supabase-js");
      const crypto = await import("crypto");

      const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
      const sbAnonKey =
        process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
      const sbServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

      if (input.newEmail.toLowerCase() === ctx.user.email?.toLowerCase()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "New email is the same as your current email",
        });
      }

      const existingUser = await getUserByEmail(input.newEmail);
      if (existingUser && existingUser.id !== ctx.user.id) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This email address is already in use",
        });
      }

      // Verify current password
      const verifyClient = createClient(sbUrl, sbAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error: signInError } = await verifyClient.auth.signInWithPassword({
        email: ctx.user.email!,
        password: input.currentPassword,
      });
      if (signInError) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect" });
      }

      // Update email in Supabase Auth
      const serviceClient = createClient(sbUrl, sbServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error: updateError } = await serviceClient.auth.admin.updateUserById(
        ctx.user.openId,
        { email: input.newEmail }
      );
      if (updateError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update email in auth system",
        });
      }

      // Update email in app database and mark as unverified
      await updateUserProfile(ctx.user.id, { email: input.newEmail });
      const dbInstance = await (await import("../db")).getDb();
      if (dbInstance) {
        const { users } = await import("../../drizzle/schema");
        const { eq } = await import("drizzle-orm");
        await dbInstance
          .update(users)
          .set({ emailVerified: false, updatedAt: new Date() } as any)
          .where(eq(users.id, ctx.user.id));
      }

      // Send verification email to new address
      const verificationToken = crypto.randomBytes(48).toString("hex");
      await deleteUserVerificationTokens(ctx.user.id);
      await createEmailVerificationToken(ctx.user.id, input.newEmail, verificationToken);

      const origin = getAppUrl(ctx.req);
      const verifyUrl = `${origin}/verify-email?token=${verificationToken}`;
      try {
        await sendVerificationEmail({
          to: input.newEmail,
          name: ctx.user.name || input.newEmail.split("@")[0],
          verifyUrl,
        });
      } catch (emailErr) {
        console.error("[Profile] Failed to send verification email:", emailErr);
      }

      return {
        success: true,
        message: "Email updated. Please check your new email for a verification link.",
      };
    }),

  /**
   * Changes the user's password.
   * - Verifies current password before allowing change
   * - Updates password in Supabase Auth
   */
  changePassword: protectedProcedure
    .input(
      z.object({
        currentPassword: z.string().min(1),
        newPassword: z.string().min(6, "Password must be at least 6 characters"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { createClient } = await import("@supabase/supabase-js");

      const sbUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
      const sbAnonKey =
        process.env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
      const sbServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

      // Verify current password
      const verifyClient = createClient(sbUrl, sbAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error: signInError } = await verifyClient.auth.signInWithPassword({
        email: ctx.user.email!,
        password: input.currentPassword,
      });
      if (signInError) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect" });
      }

      // Update password using service role client
      const serviceClient = createClient(sbUrl, sbServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { error: updateError } = await serviceClient.auth.admin.updateUserById(
        ctx.user.openId,
        { password: input.newPassword }
      );
      if (updateError) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to update password",
        });
      }

      return { success: true };
    }),
});
