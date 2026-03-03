/**
 * @deprecated The Manus Notification Service has been removed as part of the
 * Supabase Auth migration. This module is a no-op stub.
 *
 * To restore owner push notifications, integrate a service such as:
 *   - Resend (email) — already configured in server/email.ts
 *   - Slack Incoming Webhooks
 *   - Novu / Knock
 */

import { TRPCError } from "@trpc/server";

export type NotificationPayload = {
  title: string;
  content: string;
};

const TITLE_MAX_LENGTH = 1200;
const CONTENT_MAX_LENGTH = 20000;

const trimValue = (value: string): string => value.trim();
const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const validatePayload = (input: NotificationPayload): NotificationPayload => {
  if (!isNonEmptyString(input.title)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification title is required.",
    });
  }
  if (!isNonEmptyString(input.content)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Notification content is required.",
    });
  }

  const title = trimValue(input.title);
  const content = trimValue(input.content);

  if (title.length > TITLE_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification title must be at most ${TITLE_MAX_LENGTH} characters.`,
    });
  }

  if (content.length > CONTENT_MAX_LENGTH) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Notification content must be at most ${CONTENT_MAX_LENGTH} characters.`,
    });
  }

  return { title, content };
};

/**
 * No-op stub — Manus Notification Service removed.
 * Always returns false (not delivered).
 */
export async function notifyOwner(
  payload: NotificationPayload
): Promise<boolean> {
  const { title } = validatePayload(payload);
  console.warn(
    `[notifyOwner] Notification service not configured. Dropping: "${title}"`
  );
  return false;
}
