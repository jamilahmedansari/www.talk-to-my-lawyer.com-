/**
 * Notifications Router
 * Handles: listing, marking read, marking all read.
 *
 * Access: all authenticated users
 */
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getNotificationsByUserId,
  markAllNotificationsRead,
  markNotificationRead,
} from "../db";

export const notificationsRouter = router({
  /** Returns notifications for the current user (optionally unread only) */
  list: protectedProcedure
    .input(z.object({ unreadOnly: z.boolean().default(false) }).optional())
    .query(async ({ ctx, input }) =>
      getNotificationsByUserId(ctx.user.id, input?.unreadOnly ?? false)
    ),

  /** Marks a single notification as read */
  markRead: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await markNotificationRead(input.id, ctx.user.id);
      return { success: true };
    }),

  /** Marks all notifications for the current user as read */
  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    await markAllNotificationsRead(ctx.user.id);
    return { success: true };
  }),
});
